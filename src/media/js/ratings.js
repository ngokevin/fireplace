define('ratings',
    ['cache', 'capabilities', 'forms', 'jquery', 'l10n', 'login', 'models',
     'notification', 'nunjucks', 'ratingwidget', 'requests', 'settings',
     'tracking', 'underscore', 'utils', 'urls', 'user', 'z'],
    function(cache, caps, forms, $, l10n, login, models,
             notification, nunjucks, ratingwidget, requests, settings,
             tracking, _, utils, urls, user, z) {
    var gettext = l10n.gettext;
    var notify = notification.notification;
    var open_rating = false;

    function rewriter(app, processor) {
        var base_url = urls.api.base.url('reviews');
        cache.attemptRewrite(function(key) {
            if (utils.baseurl(key) !== base_url) {
                return;
            }
            var kwargs = utils.querystring(key);
            if ('app' in kwargs && kwargs.app === app) {
                return true;
            }
        }, processor);
    }

    function flagReview($review) {
        z.page.append(nunjucks.env.render('_includes/flag_review_modal.html'));
        $modal = $('mkt-prompt[data-modal="flag-review"]');

        $modal.one('click', '.reasons a', utils._pd(function(e) {
            var $actionEl = $review.find('.actions .flag');
            $modal[0].dismissModal();

            // L10n: The report is an abuse report for reviews.
            $actionEl.text(gettext('Flagging review...'));

            var endpoint = settings.api_url + urls.api.sign($review.data('report-uri'));
            requests.post(endpoint, {flag: $(e.target).data('reason')}).done(function() {
                notify({message: gettext('Review successfully flagged')});
                $actionEl.remove();
            }).fail(function() {
                notify({message: gettext('Sorry, there was an issue flagging the review. Please try again later.')});
            });
        }));
    }

    function deleteReview(reviewEl, uri, app) {
        reviewEl.addClass('deleting');
        requests.del(settings.api_url + urls.api.sign(uri)).done(function() {
            notify({message: gettext('Review deleted')});
            reviewEl.remove();

            // Update the app's review listing.
            rewriter(app, function(data) {
                data.objects = data.objects.filter(function(obj) {
                    return obj.resource_uri !== uri;
                });
                data.meta.total_count -= 1;
                if (!data.user) {
                    data.user = {};
                }
                data.user.has_rated = false;
                return data;
            });

            // Update the app model.
            var app_model;
            if (app_model = models('app').lookup(app)) {
                app_model.ratings.count -= 1;
                if (!app_model.ratings.count) {
                    app_model.ratings.average = 0;
                }
                // We cheat and don't update the average.
            }

            // Clear the user's review from the request cache.
            cache.bust(urls.api.params('reviews', {app: app, user: 'mine'}));
        }).fail(function() {
            notify({message: gettext('There was a problem deleting the review')});
        });
    }

    function loginToRate() {
        // Set a flag to know that we expect the modal to open
        // this prevents opening later if login was cancelled
        // as this flag is cleared in that case.
        open_rating = true;
        function onLoginFail() {
            open_rating = false;
        }
        function onLoginSuccess() {
            if (open_rating) {
                open_rating = false;
                var $reviewButton = $('.write-review');
                if ($reviewButton.attr('id') == 'edit-review') {
                    // Load the edit view.
                    z.page.trigger('navigate', $reviewButton.attr('href'));
                } else {
                    if (caps.widescreen()) {
                        initReviewModal()
                    } else {
                        z.page.trigger('navigate', $reviewButton.attr('href'));
                    }
                }
            }
        }
        login.login().done(onLoginSuccess).fail(onLoginFail);
        z.page.one('loaded', onLoginSuccess);
        return;
    }

    function addReview(e) {
        if (!user.logged_in()) {
            // If not logged in, prompt to do so.
            e.preventDefault();
            e.stopPropagation();
            return loginToRate();
        }

        if (caps.widescreen()) {
            e.preventDefault();
            e.stopPropagation();

            // Add review modal (for edit or add).
            if (this.id === 'edit-review') {
                var endpoint = urls.api.params('reviews', {
                    app: $('.product').data('slug'),
                    user: 'mine'
                });
                $('.write-review').html(gettext('Loading...'));
                requests.get(endpoint).done(function(existingReview) {
                    initReviewModal(existingReview.objects[0]);
                    $('.write-review').html(gettext('Edit your Review'));
                });
            } else {
                initReviewModal();
            }
        }
    }

    function initReviewModal(existingReview) {
        if (!$('mkt-prompt[data-modal="review"]').length) {
            z.body.append(
                nunjucks.env.render('_includes/review_modal.html', {
                    existingReview: existingReview,
                    slug: $('.product').data('slug')
                })
            );
            $('mkt-prompt[data-modal="review"]').find('select[name="rating"]')
                                                .ratingwidget('large');
            utils.initCharCount();
        }
    }

    z.page.on('click', '.review .actions a', utils._pd(function(e) {
        var $this = $(this);
        var action = $this.data('action');
        if (!action) {
            return;
        }
        var $review = $this.closest('.review');

        switch (action) {
            case 'delete':
                deleteReview($review, $this.data('href'), $this.data('app'));
                break;
            case 'report':
                flagReview($review);
                break;
            case 'edit':
                var view = utils.urlparams($this.attr('href'), {
                    review: $this.data('review-id')
                });
                z.page.trigger('navigate', view);
                break;
            default:
                return;
        }
        e.stopPropagation();  // Don't fire if action was matched.
    }))

    .on('click', '.write-review', addReview)

    .on('loaded', function() {
        // Hijack <select> with stars.
        $('select[name="rating"]').ratingwidget();
        utils.initCharCount();
    });

    z.doc.on('submit', '.add-review-form', utils._pd(function(e) {
        // Used for both the add review page and modal.
        var $this = $(this);
        var data = utils.getVars($this.serialize());
        var slug = data.app;

        // This must be below `.serialize()`. Disabled form controls aren't posted.
        forms.toggleSubmitFormState($this);

        requests.post(urls.api.url('reviews'), data).done(function(new_review) {
            // Update the ratings listing for the app.
            rewriter(slug, function(data) {
                data.objects.unshift(new_review);
                data.meta.total_count += 1;
                if (!data.user) {
                    data.user = {};
                }
                data.user.has_rated = true;
                return data;
            });

            var new_rating = parseInt(data.rating, 10);

            // Update the app model.
            var app_model = models('app').lookup(slug);
            if (app_model) {
                var num_ratings = app_model.ratings.count;
                if (!num_ratings) {
                    app_model.ratings.average = new_rating;
                } else {
                    // Update the app's rating to reflect the new average.
                    app_model.ratings.average =
                        (app_model.ratings.average * num_ratings + new_rating) /
                        (num_ratings + 1);
                }
                app_model.ratings.count += 1;
            }

            // Set the user's review in the request cache.
            cache.set(urls.api.params('reviews', {app: slug, user: 'mine'}), {
                meta: {limit: 20, next: null, offset: 0, total_count: 1},
                info: {average: new_rating, slug: slug},
                objects: [new_review]
            });
            notify({message: gettext('Your review was successfully posted. Thanks!')});

            z.page.trigger('navigate', urls.reverse('app', [slug]));

            tracking.trackEvent('App view interactions', 'click',
                                'Successful review');
            tracking.setVar(12, 'Reviewer', 'Reviewer', 1);
            tracking.trackEvent('Write a Review', 'click', slug, data.rating);

        }).fail(function() {
            forms.toggleSubmitFormState($this, true);
            notify({message: gettext('Sorry, there was an error posting your review. Please try again later.')});
        });
    }));

    return {
        _rewriter: rewriter
    };
});
