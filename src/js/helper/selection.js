($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.SelectionHelper = function (ext) {
        let selectedElements = {};

        /**
         * Enters selection mode -> allows clicking entries to select/delect them
         */
        this.start = () => {
            ext.elm.sidebar.addClass($.cl.sidebar.selectionMode);
            ext.elm.header.addClass($.cl.sidebar.selectionMode);
            this.updateSidebarHeader();
            updateMarkup();
        };

        /**
         * Leave selection mode again
         */
        this.leave = () => {
            ext.elm.sidebar.removeClass($.cl.sidebar.selectionMode);
            ext.elm.header.removeClass($.cl.sidebar.selectionMode);
            selectedElements = [];
            updateMarkup();
            ext.helper.list.updateSidebarHeader();

            if (ext.helper.search.searchVal) { // restore the previous search when leaving selection mode
                ext.helper.search.update(ext.helper.search.searchVal);
            }
        };

        /**
         * Returns whether the selection mode is enabled or not
         *
         * @returns {boolean}
         */
        this.isEnabled = () => ext.elm.sidebar.hasClass($.cl.sidebar.selectionMode);

        /**
         * Returns the list of selected entries
         */
        this.getSelectedAmount = () => {
            return Object.keys(selectedElements).length;
        };

        /**
         * Resets the selection list
         */
        this.reset = () => {
            selectedElements = [];
            if (this.isEnabled()) {
                this.updateSidebarHeader();
                updateMarkup();
            }
        };

        /**
         * Adds the given entry to the selection list
         *
         * @param id
         */
        this.select = (id) => {
            this.start();

            selectedElements[id] = ext.helper.entry.getDataById(id);
            this.updateSidebarHeader();
            updateMarkup();
        };

        /**
         * Removes the given entry from the selection list
         *
         * @param id
         */
        this.deselect = (id) => {
            if (selectedElements[id]) {
                delete selectedElements[id];
                this.updateSidebarHeader();
                updateMarkup();
            }
        };

        /**
         * Moves all selected entries to the given location
         *
         * @param parentId
         * @param index
         * @param initiator
         * @returns {Promise<void>}
         */
        this.moveSelection = async (parentId, index, initiator) => {
            const sort = ext.helper.model.getData("u/sort");
            const entries = getSortedSelectedEntries();
            const entriesReversed = entries.reverse();
            const initiatorId = initiator.children("a").attr($.attr.id);
            const parentList = initiator.parent("ul");

            for (const entry of entriesReversed) {
                if (entry.id === initiatorId) { // the initiator is already moved
                    continue;
                }

                const li = entry.elm.parent("li");

                if (sort.name === "custom") {
                    li.insertAfter(initiator);
                } else {
                    const index = await ext.helper.bookmark.getBookmarkIndexInDirectory(entry.id, parentId);

                    if (index === -1) {
                        li.appendTo(parentList);
                    } else if (index === 0) {
                        li.prependTo(parentList);
                    } else {
                        const prevElm = parentList.children(`li:not(.${$.cl.drag.dragInitial})`).eq(index - 1);
                        li.insertAfter(prevElm);
                    }
                }
            }

            for (const entry of entries) {
                if (entry.id === initiatorId) { // the initiator is already moved
                    continue;
                }

                await ext.helper.model.call("moveBookmark", {
                    id: entry.id,
                    parentId: parentId,
                    index: index + 1
                });

                index++;
            }
        };

        /**
         * Opens all selected entries in a new tab in the order, they are displayed in the sidebar list
         */
        this.openSelected = async () => {
            const entries = getSortedSelectedEntries();
            const bookmarks = [];
            let folderSelected = false;

            for (const entry of entries) {
                const data = selectedElements[entry.id];

                if (data.children) { // add the subfolder bookmarks of the selected folder to the list
                    folderSelected = true;
                    for (const child of data.children) {
                        if (child.url && child.url !== "about:blank") {
                            bookmarks.push(child);
                        }
                    }
                } else { // add selected bookmark to the list
                    bookmarks.push(data);
                }
            }

            if (folderSelected && bookmarks.length > ext.helper.model.getData("b/openChildrenWarnLimit")) { // more than x bookmarks and at least one folder selected -> show confirm dialog
                ext.helper.overlay.create("openSelected", ext.helper.i18n.get("contextmenu_open_children"), bookmarks);
            } else {
                ext.helper.utility.openAllBookmarks(bookmarks);
            }
        };

        /**
         * Removes all selected entries
         */
        this.deleteSelected = async () => {
            const entries = getSortedSelectedEntries();
            if (entries.length === 0) {
                return;
            }

            if (entries[entries.length - 1].dir === true) { // there is at least one directory selected -> show confirm dialog
                ext.helper.overlay.create("deleteSelected", ext.helper.i18n.get("overlay_delete_selected"), entries);
            } else {
                for (const entry of entries) {
                    await ext.helper.bookmark.removeEntry(entry.id);
                }
                this.reset();
            }
        };

        /**
         * Makes the "cancel" button smaller, if the sidebar width is too narrow to display all buttons in one line
         */
        this.handleSidebarWidthChange = () => {
            const cancelLink = ext.elm.header.children("a." + $.cl.cancel);
            const removeSelectedLink = ext.elm.header.children("a." + $.cl.sidebar.removeSelected);
            if (!cancelLink[0] || !removeSelectedLink[0]) {
                return;
            }

            if (cancelLink[0].offsetTop > removeSelectedLink[0].offsetTop * 2) {
                cancelLink.attr($.attr.type, "compact");
            }
        };

        /**
         * Updates the sidebar header to display the accurate amount of selected entries
         */
        this.updateSidebarHeader = () => {
            ext.elm.header.text("");

            const selectedAmount = Object.keys(selectedElements).length;
            $("<h1></h1>")
                .html("<strong>" + selectedAmount + "</strong> <span>" + ext.helper.i18n.get("header_selected_entries") + "</span>")
                .attr("title", selectedAmount + " " + ext.helper.i18n.get("header_selected_entries", null, true))
                .appendTo(ext.elm.header);

            $("<a></a>").addClass($.cl.sidebar.openSelected).appendTo(ext.elm.header);
            $("<a></a>").addClass($.cl.sidebar.removeSelected).appendTo(ext.elm.header);
            $("<a></a>").addClass($.cl.cancel).text(ext.helper.i18n.get("overlay_cancel")).appendTo(ext.elm.header);

            ext.helper.list.handleSidebarWidthChange();
            this.handleSidebarWidthChange();
        };

        /**
         * Returns the selected entries sorted by their occurrence in the sidebar,
         * will list the bookmarks first and then list the folders
         *
         * @returns {Array}
         */
        const getSortedSelectedEntries = () => {
            const ret = [];
            const box = ext.helper.list.getActiveBookmarkBox();

            Object.entries(selectedElements).forEach(([id, data]) => {
                const entry = box.find("> ul a[" + $.attr.id + "='" + id + "']");
                ret.push({
                    elm: entry,
                    id: id,
                    dir: !!data.isDir,
                    offsetTop: entry[0].offsetTop
                });
            });

            ret.sort((a, b) => {
                if (a.dir !== b.dir) { // first criteria = isDir -> directories should be listed last
                    return a.dir ? 1 : -1;
                }
                return (a.offsetTop - b.offsetTop); // compare their top offset
            });

            return ret;
        };

        /**
         * Updates the html markup to highlight the selected entries
         */
        const updateMarkup = () => {
            const box = ext.helper.list.getActiveBookmarkBox();

            box.find("> ul a[" + $.attr.id + "]." + $.cl.selected).forEach((elm) => { // remove selection for all entries which are not in the list of selected entries
                const elmObj = $(elm);
                const id = $(elmObj).attr($.attr.id);
                if (ext.helper.checkbox.isChecked(elmObj) && !selectedElements[id]) {
                    elmObj.find("div." + $.cl.checkbox.box).trigger("click");
                }
                elmObj.removeClass($.cl.selected);
            });

            Object.keys(selectedElements).forEach((id) => { // highlight the selected entries
                const data = ext.helper.entry.getDataById(id);
                const entry = box.find("> ul a[" + $.attr.id + "='" + data.id + "']");

                if (!ext.helper.checkbox.isChecked($(entry))) {
                    $(entry).find("div." + $.cl.checkbox.box).trigger("click");
                }

                entry.addClass($.cl.selected);
            });
        };
    };

})(jsu);