REPO = "fireplace"
UUID = "8af8c763-da9b-444d-a911-206f9e225b55"
VERSION = `date "+%Y.%m.%d_%H.%M.%S"`
VERSION_INT = $(shell date "+%Y%m%d%H%M%S")
TMP = _tmp

# This is what the iframe src points to.
DOMAIN?=marketplace.firefox.com

# This is what the app will be named on the device.
NAME?=Marketplace

compile:
	commonplace compile

test: clean compile
	cd smokealarm ; \
	casperjs test tests

# Fireplace (real packaged app)
package: clean
	@cp hearth/media/js/settings_local.js hearth/media/js/settings_local.js.bak
	@cp hearth/media/js/settings_package.js hearth/media/js/settings_local.js

	@commonplace includes
	@commonplace langpacks

	@mv hearth/media/js/settings_local.js.bak hearth/media/js/settings_local.js

	@mkdir -p TMP && cp -pR hearth/* TMP/.

	@# We have to have a temp file to work around a bug in Mac's version of sed :(
	@sed -i'.bak' -e 's/marketplace\.firefox\.com/$(DOMAIN)/g' TMP/manifest.webapp
	@sed -i'.bak' -e 's/{fireplace_package_version}/$(VERSION_INT)/g' TMP/{manifest.webapp,media/js/include.js}

	@rm -rf  package/archives/latest
	@mkdir -p package/archives/latest
	@rm -f package/archives/latest.zip

	@pushd TMP && \
		cat ../package/files.txt | zip -9 -r ../package/archives/$(NAME)_$(VERSION_INT).zip -@ && \
		popd
	@cp package/archives/$(NAME)_$(VERSION_INT).zip package/archives/latest.zip
	@echo "Created file: package/archives/$(NAME)_$(VERSION_INT).zip"

	@pushd package/archives/latest && \
		unzip ../latest.zip && \
		popd

	@rm -rf TMP

servepackage:
	@open 'http://localhost:8676/app.html'
	@pushd package/archives/latest && \
		python -m SimpleHTTPServer 8676

# Yulelog (iframe'd packaged app)
log: clean
	@mkdir -p TMP && cp -pR yulelog/* TMP/.
	@# We have to have a temp file to work around a bug in Mac's version of sed :(
	@sed -i'.bak' -e 's/marketplace\.firefox\.com/$(DOMAIN)/g' TMP/{main.js,manifest.webapp}
	@sed -i'.bak' -e 's/{version}/$(VERSION_INT)/g' TMP/manifest.webapp
	@sed -i'.bak' -e 's/"Marketplace"/"$(NAME)"/g' TMP/manifest.webapp
	@rm -f TMP/README.md
	@rm -f TMP/*.bak
	@cd TMP && zip -q -r ../yulelog_$(NAME)_$(VERSION_INT).zip * && cd ../
	@rm -rf TMP
	@echo "Created file: yulelog_$(NAME)_$(VERSION_INT).zip"

submit:
	@open 'https://'$(DOMAIN)'/developers/app/marketplace/status#upload-new-version'

approve:
	@open 'https://'$(DOMAIN)'/reviewers/apps/review/marketplace#review-actions'

clean:
	commonplace clean

deploy:
	git fetch && git reset --hard origin/master && npm install && make includes

