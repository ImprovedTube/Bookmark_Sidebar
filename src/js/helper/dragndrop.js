($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.DragDropHelper = function (ext) {

        let sidebarPos = null;
        let showCreationDialog = false;
        let oldAboveElm = null;
        let oldTopVal = 0;
        let dirOpenTimeout = null;
        let sort = null;

        const edgeScroll = {
            running: false,
            posY: null,
            previousDelta: 0,
            fpsLimit: 30
        };

        /**
         * Initializes the events for the drag n drop functionality
         *
         * @returns {Promise}
         */
        this.init = async () => {
            sidebarPos = ext.helper.model.getData("b/sidebarPosition");
            showCreationDialog = ext.helper.model.getData("b/dndCreationDialog");
            initEvents();
            initExternalDragDropEvents();
        };

        /**
         * Cancels the dragging and resets the position of the dragged element
         */
        this.cancel = async () => {
            const draggedElm = ext.elm.iframeBody.children("a." + $.cl.drag.helper);
            const dragInitialElm = ext.elm.bookmarkBox.all.find("li." + $.cl.drag.dragInitial);
            const entryElm = draggedElm.data("elm");

            if (entryElm) {
                entryElm.insertAfter(dragInitialElm).removeClass($.cl.drag.isDragged);
            }

            dragInitialElm.remove();
            draggedElm.remove();
            ext.elm.iframeBody.removeClass([$.cl.drag.isDragged, $.cl.drag.cancel]);
            ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

            await $.delay(500);
            ext.helper.toggle.removeSidebarHoverClass();
        };

        /**
         * Checks if the dragged element is outside of the sidebar, so the mouseup will cause an abort and not a repositioning
         *
         * @param {jsu|int} elm
         * @returns {boolean}
         */
        const isDraggedElementOutside = (elm) => {
            let offset = 0;

            if (typeof elm === "object") {
                const boundClientRect = elm[0].getBoundingClientRect();
                offset = boundClientRect.left;
            } else {
                offset = +elm;
            }

            if (sidebarPos === "right") {
                offset = window.innerWidth - offset;
            }

            if (typeof elm === "object") {
                return elm.realWidth() * 0.6 + offset > ext.elm.sidebar.realWidth();
            } else {
                return offset > ext.elm.sidebar.realWidth();
            }
        };

        /**
         * Initialises the eventhandler for external elements beeing dragged into the sidebar (e.g. a link, an image, ...)
         */
        const initExternalDragDropEvents = () => {
            ext.elm.iframeBody.on("dragenter", () => {
                const body = $("body");
                if (body.attr("id") === $.opts.ids.page.newtab && body.hasClass($.cl.newtab.edit)) { // disable drag&drop when in edit mode of the new tab page
                    return;
                }

                ext.helper.contextmenu.close();
                ext.helper.tooltip.close();
                ext.elm.iframeBody.addClass($.cl.drag.isDragged);
                ext.helper.toggle.addSidebarHoverClass();
                sort = ext.helper.model.getData("u/sort");

                if (!edgeScroll.running) {
                    window.requestAnimationFrame(edgeScrolling);
                }
            }).on("drop dragend", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                edgeScroll.posY = null;
                ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

                if (!ext.elm.iframeBody.hasClass($.cl.drag.isDragged)) { // nothing has been dragged
                    return;
                }

                if (!isDraggedElementOutside(e.pageX) && ext.helper.search.isResultsVisible() === false) { // only proceed if mouse position is in the sidebar and the active view are not the search results
                    const entryPlaceholder = ext.elm.bookmarkBox.all.find("li." + $.cl.drag.isDragged).eq(0);

                    if (entryPlaceholder && entryPlaceholder.length() > 0) {
                        const url = e.dataTransfer.getData("URL");
                        let title = e.dataTransfer.getData("text/plain");

                        if (location.href === url) {
                            title = document.title || "";
                        } else if (title === url) {
                            const html = e.dataTransfer.getData("text/html");

                            if (html && html.length > 0) {
                                title = $("<div></div>").html(html).text();
                            } else {
                                title = "";
                            }
                        }

                        const bookmarkObj = {
                            index: entryPlaceholder.prevAll("li").length(),
                            parentId: entryPlaceholder.parent("ul").prev("a").attr($.attr.id),
                            title: title.trim(),
                            url: url
                        };

                        const showOverlay = () => {
                            ext.helper.overlay.create("add", ext.helper.i18n.get("contextmenu_add"), {
                                values: bookmarkObj
                            });
                        };

                        if (showCreationDialog === false && bookmarkObj.title && bookmarkObj.url) { // title and url could be determined from the dragged element -> create bookmark directly
                            const result = await ext.helper.model.call("createBookmark", bookmarkObj);
                            if (result.error) {
                                showOverlay();
                            }
                        } else { // title or url is unknown -> open overlay with dialog
                            showOverlay();
                        }
                    }
                }

                ext.elm.iframeBody.removeClass([$.cl.drag.isDragged, $.cl.drag.cancel]);
                ext.helper.toggle.removeSidebarHoverClass();
            });
        };

        /**
         * Returns the type of the element which is dragged
         *
         * @param {jsu|string} elm
         */
        const getDragType = (elm) => {
            let type = "bookmark";

            if (elm === "selection") { // element is text
                type = elm;
            } else if (elm.data("type")) { // element type is cached in data obj
                type = elm.data("type");
            } else { // determine type of given element
                if (elm.hasClass($.cl.sidebar.bookmarkDir)) {
                    type = "directory";
                } else if (elm.parents("div." + $.cl.sidebar.entryPinned).length() > 0) {
                    type = "pinned";
                }

                elm.data("type", type);
            }

            return type;
        };

        /**
         * Start dragging an element (bookmark or directory)
         *
         * @param {Element} node
         * @param {int} x
         * @param {int} y
         */
        const dragstart = (node, x, y) => {
            ext.helper.contextmenu.close();
            ext.helper.tooltip.close();

            const elm = $(node).parent("a").removeClass($.cl.sidebar.dirOpened);
            const id = elm.attr($.attr.id);
            const data = ext.helper.entry.getDataById(id);

            if (data === null) {
                return false;
            }

            if (ext.helper.selection.isEnabled()) { // select dragged entry when in selection mode (may already be selected by the user)
                ext.helper.selection.select(id);
            }

            sort = ext.helper.model.getData("u/sort");
            const elmParent = elm.parent("li");
            const parentTrigger = elmParent.parent("ul").prev("a");

            ext.elm.iframeBody.addClass($.cl.drag.isDragged);
            elmParent.clone().addClass($.cl.drag.dragInitial).insertAfter(elmParent);

            const helper = elm.clone().appendTo(ext.elm.iframeBody);
            if (ext.helper.selection.isEnabled()) { // select dragged entry when in selection mode (may already be selected by the user)
                $("<span></span>")
                    .addClass($.cl.selected)
                    .text(ext.helper.selection.getSelectedAmount())
                    .appendTo(helper);
            }

            const boundClientRect = elm[0].getBoundingClientRect();

            let index = 0;
            elmParent.prevAll("li").forEach((entry) => {
                if (!$(entry).hasClass($.cl.drag.dragInitial)) {
                    index++;
                }
            });

            helper.removeAttr("title").css({
                top: boundClientRect.top + "px",
                left: boundClientRect.left + "px",
                width: elm.realWidth() + "px"
            }).data({
                elm: elmParent,
                isDir: !!(data.isDir),
                parentId: parentTrigger.length() > 0 ? parentTrigger.attr($.attr.id) : null,
                index: index,
                startPos: {
                    top: y - boundClientRect.top,
                    left: x - boundClientRect.left
                }
            }).addClass($.cl.drag.helper);

            elmParent.addClass($.cl.drag.isDragged);

            if (!edgeScroll.running) {
                window.requestAnimationFrame(edgeScrolling);
            }
        };

        /**
         * Scrolls the bookmark list automatically when the user drags an element near the top or bottom of the list
         *
         * @param {int} currentDelta
         */
        const edgeScrolling = (currentDelta) => {
            window.requestAnimationFrame(edgeScrolling);
            const delta = currentDelta - edgeScroll.previousDelta;

            if (edgeScroll.fpsLimit && delta < 1000 / edgeScroll.fpsLimit) {
                return;
            }

            if (edgeScroll.posY !== null) {
                const bookmarkBoxTopOffset = ext.elm.bookmarkBox.all[0].offsetTop;
                const bookmarkBoxHeight = ext.elm.bookmarkBox.all[0].offsetHeight;
                const scrollPos = ext.helper.scroll.getScrollPos(ext.elm.bookmarkBox.all);
                let newScrollPos = null;

                if (edgeScroll.posY - bookmarkBoxTopOffset < 60) {
                    newScrollPos = scrollPos - Math.pow((50 - edgeScroll.posY + bookmarkBoxTopOffset) / 10, 2);
                } else if (edgeScroll.posY + 60 > bookmarkBoxHeight) {
                    newScrollPos = scrollPos + Math.pow((edgeScroll.posY + 50 - bookmarkBoxHeight) / 10, 2);
                }

                if (newScrollPos) {
                    ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.all, newScrollPos);
                }
            }

            edgeScroll.previousDelta = currentDelta;
        };

        /**
         * Stop dragging an element (bookmark or directory)
         */
        const dragend = async () => {
            clearDirOpenTimeout();
            const draggedElm = ext.elm.iframeBody.children("a." + $.cl.drag.helper);

            if (isDraggedElementOutside(draggedElm)) {// cancel drop if mouse position is outside the sidebar
                this.cancel();
            } else { // animate the helper back to the new position and save it
                draggedElm.addClass($.cl.drag.snap);

                const dragInitialElm = ext.elm.bookmarkBox.all.find("li." + $.cl.drag.dragInitial);
                let entryElm = draggedElm.data("elm");
                const elm = entryElm.children("a");
                const type = getDragType(elm);
                const parentList = entryElm.parent("ul");
                const parentId = parentList.prev("a").attr($.attr.id);
                const elmId = elm.attr($.attr.id);
                let index = 0;

                if (sort.name === "custom") {
                    entryElm.prevAll("li").forEach((el) => {
                        if (el !== dragInitialElm) {
                            index++;
                        }
                    });
                } else {
                    const index = await ext.helper.bookmark.getBookmarkIndexInDirectory(elmId, parentId);

                    if (index === -1) {
                        entryElm = entryElm.appendTo(parentList);
                    } else {
                        const prevElm = parentList.children(`li:not(.${$.cl.drag.dragInitial})`).eq(index);
                        entryElm = entryElm.insertAfter(prevElm);
                    }
                }

                ext.elm.iframeBody.removeClass($.cl.drag.isDragged);
                ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

                await $.delay();
                const boundClientRect = entryElm[0].getBoundingClientRect();

                draggedElm.css({
                    top: boundClientRect.top + "px",
                    left: boundClientRect.left + "px"
                });

                await $.delay(200);
                entryElm.removeClass($.cl.drag.isDragged);
                dragInitialElm.remove();
                draggedElm.remove();

                if (type === "pinned") { // save position of pinned entry
                    ext.helper.bookmark.reorderPinnedEntries({
                        id: elmId,
                        prevId: entryElm.prev("li").children("a").attr($.attr.id)
                    });
                } else { // save bookmark/directory position
                    await ext.helper.model.call("moveBookmark", {
                        id: elmId,
                        parentId: parentId,
                        index: index
                    });

                    if (ext.helper.selection.isEnabled()) { // handle multi drag&drop
                        ext.helper.selection.moveSelection(parentId, index, entryElm);
                    }
                }

                await $.delay(300);
                ext.helper.toggle.removeSidebarHoverClass();
            }
        };

        /**
         * Clears the directory open timeout
         *
         * @param {jsu} checkElm
         */
        const clearDirOpenTimeout = (checkElm = null) => {
            if (dirOpenTimeout !== null && (checkElm === null || dirOpenTimeout.id !== checkElm.attr($.attr.id))) {
                dirOpenTimeout.elm.removeClass($.cl.drag.dragHover);
                clearTimeout(dirOpenTimeout.instance);
                dirOpenTimeout = null;
            }
        };

        /**
         * Drag an element (bookmark or directory or something external (a link, an image, ...))
         *
         * @param {string} eventType
         * @param {int} x
         * @param {int} y
         */
        const dragmove = (eventType, x, y) => {
            let draggedElm = null;
            let bookmarkElm = null;
            let topVal = 0;
            let leftVal = 0;

            if (eventType === "dragover") { // dragging anything (e.g. a link, an image, ...)
                topVal = y - 20;
                leftVal = x;
                if (topVal === oldTopVal) {
                    return false;
                }
                oldTopVal = topVal;
                ext.elm.bookmarkBox.all.find("li." + $.cl.drag.isDragged).remove();
                bookmarkElm = $("<li></li>").html("<a>&nbsp;</a>").addClass($.cl.drag.isDragged);
            } else { // dragging bookmark or directory
                draggedElm = ext.elm.iframeBody.children("a." + $.cl.drag.helper);
                const startPos = draggedElm.data("startPos");
                topVal = y - startPos.top;
                leftVal = x - startPos.left;

                draggedElm.css({
                    top: topVal + "px",
                    left: leftVal + "px"
                });

                bookmarkElm = draggedElm.data("elm");
            }

            ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

            if (isDraggedElementOutside(draggedElm || leftVal)) { // dragged outside the sidebar -> mouseup will cancel
                clearDirOpenTimeout();
                ext.elm.iframeBody.addClass($.cl.drag.cancel);
                return false;
            } else {
                ext.elm.iframeBody.removeClass($.cl.drag.cancel);
            }

            const type = getDragType(bookmarkElm.children("a"));
            let newAboveElm = {elm: null};
            let elmLists;

            if (type === "pinned") {
                elmLists = [ext.elm.pinnedBox.find("> ul > li")];
            } else {
                edgeScroll.posY = y;
                elmLists = [
                    ext.elm.bookmarkBox.all.find("a." + $.cl.sidebar.dirOpened + " + ul > li"),
                    ext.elm.bookmarkBox.all.find("> ul > li > a." + $.cl.sidebar.dirOpened).parent("li")
                ];
            }

            elmLists.some((list) => {
                list && list.forEach((node) => { // determine the element which is above the current drag position
                    const elmObj = $(node);

                    if (elmObj[0] !== bookmarkElm[0] && !elmObj.hasClass($.cl.drag.dragInitial)) {
                        const boundClientRect = elmObj[0].getBoundingClientRect();
                        const diff = topVal - boundClientRect.top;

                        if (boundClientRect.top > topVal) {
                            return false;
                        } else if (newAboveElm.elm === null || newAboveElm.diff > diff) {
                            const isDir = elmObj.children("a").eq(0).hasClass($.cl.sidebar.bookmarkDir);

                            if (sort.name !== "custom" && !isDir) { // every other sorting than "custom" is only folder-based -> determine parent folder of the element
                                newAboveElm = {
                                    elm: elmObj.parents("li").eq(0),
                                    height: elmObj[0].offsetHeight,
                                    diff: diff
                                };
                            } else {
                                newAboveElm = {elm: elmObj, height: elmObj[0].offsetHeight, diff: diff};
                            }
                        }
                    }
                });
            });

            if (newAboveElm.elm && newAboveElm.elm !== oldAboveElm) {
                oldAboveElm = newAboveElm.elm;
                const newAboveLink = newAboveElm.elm.children("a").eq(0);
                const parentElm = newAboveElm.elm.parents("li").eq(0);
                const isTopLevel = !parentElm || parentElm.length() === 0;
                const aboveIsDir = newAboveLink.hasClass($.cl.sidebar.bookmarkDir);
                const hoverPosPercentage = newAboveElm.diff / newAboveElm.height * 100;

                clearDirOpenTimeout(newAboveLink);

                if (newAboveElm.elm.nextAll("li:not(." + $.cl.drag.isDragged + ")").length() === 0 && hoverPosPercentage > 80) { // drag position is below the last element of a directory -> placeholder under the current directory
                    if (draggedElm && parentElm.parents("ul")[0] !== ext.elm.bookmarkBox.all.find("> ul")[0]) {
                        setDataElement(draggedElm, bookmarkElm.insertAfter(parentElm));
                    }
                } else if (aboveIsDir && (hoverPosPercentage < 60 || sort.name !== "custom")) { // directory is hovered
                    if (newAboveLink.hasClass($.cl.sidebar.dirOpened)) { // opened directory
                        setDataElement(draggedElm, bookmarkElm.prependTo(newAboveLink.next("ul")));
                    } else if (!newAboveLink.hasClass($.cl.sidebar.dirAnimated)) { // closed directory
                        if (dirOpenTimeout === null) {
                            dirOpenTimeout = {
                                id: newAboveLink.attr($.attr.id),
                                elm: newAboveLink.addClass($.cl.drag.dragHover)
                            };

                            const dndOpenDirDelayRaw = ext.helper.model.getData("b/dndOpenDirDelay");
                            dirOpenTimeout.instance = setTimeout(() => { // open closed directory after short delay -> possibility for user to cancel timeout
                                ext.helper.list.toggleBookmarkDir(newAboveLink);
                            }, +dndOpenDirDelayRaw * 1000);
                        }
                    } else if (newAboveLink.next("ul").length() === 0) { // empty directory
                        newAboveLink.addClass($.cl.sidebar.dirOpened);
                        $("<ul></ul>").insertAfter(newAboveLink);
                    }
                } else if (!isTopLevel || type === "pinned") { // drag position is below a bookmark
                    clearDirOpenTimeout();
                    setDataElement(draggedElm, bookmarkElm.insertAfter(newAboveElm.elm));
                }
            } else if (type === "pinned") { // pinned entry -> no element above -> index = 0
                setDataElement(draggedElm, bookmarkElm.prependTo(ext.elm.pinnedBox.children("ul")));
            }
        };

        const setDataElement = (draggedElm, dataElm) => {
            if (draggedElm) {
                draggedElm.data("elm", dataElm);
            }
            if (sort.name !== "custom") {
                dataElm.parents("li").eq(0).addClass($.cl.drag.dragHover);
            }
        };

        /**
         * Initializes the eventhandlers for the dragDrop functionality of the bookmarks
         */
        const initEvents = () => {

            ext.elm.bookmarkBox.all.on("mousedown", "span." + $.cl.drag.trigger, (e) => { // drag start
                ext.helper.toggle.addSidebarHoverClass();
                dragstart(e.currentTarget, e.pageX, e.pageY);
                dragmove(e.type, e.pageX, e.pageY);
            });

            ext.elm.iframeBody.on("mouseup", async (e) => { // drag end
                edgeScroll.posY = null;
                if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged)) { // bookmark has been dragged
                    e.preventDefault();
                    e.stopPropagation();

                    if (e.buttons === 0) { // only perform rearrangement of elements when the left mouse button is released
                        await dragend();
                    } else { // cancel drag
                        await $.delay(0);
                        await this.cancel();
                    }
                }
            });

            ext.elm.iframeBody.on("wheel", (e) => { // scroll the bookmark list
                if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged)) {
                    e.stopPropagation();
                    const scrollPos = ext.elm.bookmarkBox.all[0].scrollTop;
                    ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.all, scrollPos - e.wheelDelta, 300);
                }
            }, {passive: true});

            ext.elm.iframeBody.on("mousemove dragover", (e) => { // drag move
                if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged) && (e.buttons === 1 || e.button === 0)) {
                    e.preventDefault();
                    e.stopPropagation();
                    dragmove(e.type, e.pageX, e.pageY);
                }
            });

            ext.elm.iframeBody.on("contextmenu", "a." + $.cl.drag.helper, (e) => { // disable right click or the drag handle
                e.preventDefault();
                e.stopPropagation();
            });
        };
    };

})(jsu);
