($ => {
    "use strict";

    const background = function () {
        this.importRunning = false;
        this.preventReload = false;
        this.reinitialized = null;

        /**
         * Sends a message to all tabs, so they are reloading the sidebar
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.reload = (opts) => {
            return new Promise((resolve) => {
                Promise.all([
                    this.helper.newtab.updateConfig(),
                    this.helper.cache.remove({name: "htmlList"}),
                    this.helper.cache.remove({name: "htmlPinnedEntries"})
                ]).then(() => {
                    $.api.tabs.query({}, (tabs) => {
                        tabs.forEach((tab, i) => {
                            const delay = tab.active ? 0 : (i * 100); // stagger the reload event for all tabs which are not currently visible

                            $.delay(delay).then(() => {
                                $.api.tabs.sendMessage(tab.id, {
                                    action: "reload",
                                    scrollTop: opts.scrollTop || false,
                                    reinitialized: this.reinitialized,
                                    type: opts.type
                                });
                            });
                        });

                        resolve();
                    });
                });
            });
        };

        /**
         * Injects the content scripts to all tabs and because of this runs the extension there again
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.reinitialize = (opts = {}) => {
            return new Promise((resolve) => {
                this.reinitialized = +new Date();

                const types = {
                    css: "insertCSS",
                    js: "executeScript"
                };

                Promise.all([
                    this.helper.newtab.updateConfig(),
                    this.helper.language.init(),
                    this.helper.cache.remove({name: "htmlList"}),
                    this.helper.cache.remove({name: "htmlPinnedEntries"})
                ]).then(() => {
                    let type = null;

                    if (opts && opts.type) {
                        type = opts.type;
                    }

                    $.api.tabs.query({}, (tabs) => {
                        tabs.forEach((tab, i) => {
                            if (typeof tab.url === "undefined" || tab.url.startsWith("http://") || tab.url.startsWith("https://") || tab.url.startsWith("file://")) {
                                const delay = tab.active ? 0 : (i * 100); // stagger script injection for all tabs which are not currently visible

                                $.delay(delay).then(() => {
                                    Object.entries(types).forEach(([type, func]) => {
                                        const files = $.opts.manifest.content_scripts[0][type];
                                        let failed = false;

                                        files.forEach((file) => {
                                            $.api.tabs[func](tab.id, {file: file}, () => {
                                                const error = $.api.runtime.lastError; // do nothing specific with the error -> is thrown if the tab cannot be accessed (like chrome:// urls)
                                                if (error && error.message && failed === false) { // send a notification instead to let the page deal with it
                                                    failed = true;
                                                    notifyReinitialization(tab.id, type);
                                                }
                                            });
                                        });
                                    });
                                });
                            } else { // send a notification instead of loading the scripts to let the page deal with the reinitialization
                                notifyReinitialization(tab.id, type);
                            }
                        });

                        resolve();
                    });
                });
            });
        };

        /**
         * Sends a message to the given tab to notify it that a reinitialization needs to be performed,
         * will be called if script injection failed (like on the newtab replacement page)
         *
         * @param {int} tabId
         * @param {string} type
         */
        const notifyReinitialization = (tabId, type) => {
            $.api.tabs.sendMessage(tabId, {
                action: "reinitialize",
                type: type
            });
        };

        /**
         * Initialises the eventhandlers
         *
         * @returns {Promise}
         */
        const initEvents = async () => {
            $.api.bookmarks.onImportBegan.addListener(() => { // indicate that the import process started
                this.importRunning = true;
            });

            $.api.bookmarks.onImportEnded.addListener(() => { // indicate that the import process finished
                this.importRunning = false;
            });

            ["Changed", "Created", "Removed"].forEach((eventName) => { // trigger an event in all tabs after changing/creating/removing a bookmark
                $.api.bookmarks["on" + eventName].addListener(() => {
                    if (this.importRunning === false && this.preventReload === false) { // don't reload sidebar while import in running
                        this.reload({type: eventName});
                    }
                });
            });

            ["Moved", "ChildrenReordered"].forEach((eventName) => { // deleted the html cache after moving a bookmark
                $.api.bookmarks["on" + eventName].addListener(() => {
                    Promise.all([
                        this.helper.cache.remove({name: "htmlList"}),
                        this.helper.cache.remove({name: "htmlPinnedEntries"})
                    ]);
                });
            });
        };

        /**
         * Initialises the helper objects
         */
        const initHelpers = () => {
            this.helper = {
                model: new $.ModelHelper(this),
                bookmarks: new $.Bookmarks(this),
                language: new $.LanguageHelper(this),
                upgrade: new $.UpgradeHelper(this),
                viewAmount: new $.ViewAmountHelper(this),
                newtab: new $.NewtabHelper(this),
                image: new $.ImageHelper(this),
                port: new $.PortHelper(this),
                icon: new $.IconHelper(this),
                browserAction: new $.BrowserActionHelper(this),
                utility: new $.UtilityHelper(this),
                linkchecker: new $.Linkchecker(this),
                cache: new $.CacheHelper(this),
                analytics: new $.AnalyticsHelper(this)
            };
        };

        /**
         * Calls the according method of the upgrade helper after installing or updating the extension,
         * waits 500ms if the helper is not initialized yet and calls itself again
         *
         * @param {object} details
         * @param {int} i
         */
        const callOnInstalledCallback = (details, i = 0) => {
            if (this.helper && this.helper.upgrade && this.helper.upgrade.loaded) {
                if (details.reason === "install") { // extension was installed
                    this.helper.upgrade.onInstalled(details);
                } else if (details.reason === "update") { // extension was updated
                    this.helper.upgrade.onUpdated(details);
                }
            } else if (i < 100) {
                $.delay(500).then(() => {
                    callOnInstalledCallback(details, i + 1);
                });
            }
        };

        /**
         *
         */
        this.run = () => {
            const start = +new Date();
            let isBrowserStart = false;

            $.api.runtime.onInstalled.addListener((details) => {
                callOnInstalledCallback(details);
            });

            $.api.runtime.onStartup.addListener(() => {
                isBrowserStart = true;
            });

            $.api.runtime.setUninstallURL($.opts.website.info[$.isDev ? "landing" : "uninstall"]);

            initHelpers();

            Promise.all([
                this.helper.model.init(),
                this.helper.language.init(),
                this.helper.analytics.init(),
                this.helper.bookmarks.init()
            ]).then(() => {
                return this.helper.icon.init();
            }).then(() => {
                return Promise.all([
                    initEvents(),
                    this.helper.browserAction.init(),
                    this.helper.newtab.init(),
                    this.helper.image.init(),
                    this.helper.port.init(),
                    this.helper.upgrade.init()
                ]);
            }).then(() => {
                return this.helper.analytics.trackUserData();
            }).then(() => {
                this.helper.newtab.reload();

                if (isBrowserStart) {
                    return Promise.resolve();
                } else {
                    return this.reinitialize();
                }
            }).then(() => {
                const rnd = Math.floor(Math.random() * 20) + 1;
                if (rnd === 1) { // check if the license key is valid and if not, remove it from the sync storage (only perform this check for every 20th reload of the background script)
                    this.helper.model.getLicenseKey().then((response) => {
                        return this.helper.utility.checkLicenseKey(response.licenseKey);
                    }).then((response) => {
                        if (response.valid === false) {
                            this.helper.model.setLicenseKey(null);
                        }
                    });
                }

                /* eslint-disable no-console */
                if ($.isDev && console && console.info) {
                    console.info("Finished loading background script", +new Date() - start);
                }
            });
        };
    };

    new background().run();
})(jsu);