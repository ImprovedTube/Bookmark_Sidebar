/*! (c) Philipp König under GPL-3.0 */
"use strict";function a(a,b,c){return b in a?Object.defineProperty(a,b,{value:c,enumerable:!0,configurable:!0,writable:!0}):a[b]=c,a}!function(b){window.TemplateHelper=function(a){this.loading=function(){return b('<svg class="loading" width="36px" height="36px" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke-width="3" stroke-linecap="round" cx="18" cy="18" r="16"></circle></svg>')},this.footer=function(){var a=b('<footer> <a id="copyright" href="https://blockbyte.de/extensions" target="_blank">  &copy; <span class="created">2016</span>&ensp;<strong>Blockbyte</strong> </a></footer>'),c=+a.find("span.created").text(),d=(new Date).getFullYear();return d>c&&a.find("span.created").text(c+" - "+d),a}},window.translation=function(){var c=this,d=null;this.languages={af:"Afrikaans",ar:"Arabic",hy:"Armenian",be:"Belarusian",bg:"Bulgarian",ca:"Catalan","zh-CN":"Chinese (Simplified)","zh-TW":"Chinese (Traditional)",hr:"Croatian",cs:"Czech",da:"Danish",nl:"Dutch",en:"English",eo:"Esperanto",et:"Estonian",tl:"Filipino",fi:"Finnish",fr:"French",de:"German",el:"Greek",iw:"Hebrew",hi:"Hindi",hu:"Hungarian",is:"Icelandic",id:"Indonesian",it:"Italian",ja:"Japanese",ko:"Korean",lv:"Latvian",lt:"Lithuanian",no:"Norwegian",fa:"Persian",pl:"Polish",pt:"Portuguese",ro:"Romanian",ru:"Russian",sr:"Serbian",sk:"Slovak",sl:"Slovenian",es:"Spanish",sw:"Swahili",sv:"Swedish",th:"Thai",tr:"Turkish",uk:"Ukrainian",vi:"Vietnamese"},this.opts={elm:{body:b("body"),title:b("head > title"),header:b("body > header"),content:b("section#content"),backToOverview:b("section#content > a.back"),save:b("section#content > div[data-name='langvars'] > header > button.save"),wrapper:{overview:b("section#content > div[data-name='overview']"),langvars:b("section#content > div[data-name='langvars']")}},classes:{hidden:"hidden",progress:"progress",loading:"loading",active:"active",langVarCategory:"category",languagesSelect:"languages",edit:"edit",success:"success"},attr:{success:"data-successtext"},ajax:{info:"https://blockbyte.de/ajax/extensions/bs/i18n/info",langvars:"https://blockbyte.de/ajax/extensions/bs/i18n/langvars",submit:"https://blockbyte.de/ajax/extensions/bs/i18n/submit"},manifest:chrome.runtime.getManifest()},this.run=function(){g("overview"),f(),e(),h(),c.helper.i18n.init(function(){c.helper.template.footer().insertAfter(c.opts.elm.content),c.helper.i18n.parseHtml(document),c.opts.elm.title.text(c.opts.elm.title.text()+" - "+c.opts.manifest.short_name),j(),m()})};var e=function(){c.opts.elm.header.prepend('<svg height="48" width="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>')},f=function(){c.helper={template:new window.TemplateHelper(c),i18n:new window.I18nHelper(c)}},g=function(a){"overview"===a?c.opts.elm.backToOverview.addClass(c.opts.classes.hidden):c.opts.elm.backToOverview.removeClass(c.opts.classes.hidden),Object.keys(c.opts.elm.wrapper).forEach(function(b){b===a?c.opts.elm.wrapper[b].removeClass(c.opts.classes.hidden):c.opts.elm.wrapper[b].addClass(c.opts.classes.hidden)})},h=function(){Object.keys(c.opts.elm.wrapper).forEach(function(a){!1===c.opts.elm.wrapper[a].hasClass(c.opts.classes.hidden)&&(c.opts.elm.wrapper[a].addClass(c.opts.classes.loading),d=c.helper.template.loading().appendTo(c.opts.elm.wrapper[a]))})},i=function(){var a=arguments.length>0&&void 0!==arguments[0]?arguments[0]:300;setTimeout(function(){d&&d.remove(),Object.keys(c.opts.elm.wrapper).forEach(function(a){!1===c.opts.elm.wrapper[a].hasClass(c.opts.classes.hidden)&&c.opts.elm.wrapper[a].removeClass(c.opts.classes.loading)})},a)},j=function(){c.opts.elm.wrapper.overview.find("> div > ul").remove(),c.opts.elm.wrapper.overview.find("> div > select."+c.opts.classes.languagesSelect).remove();var a=new XMLHttpRequest;a.open("POST",c.opts.ajax.info,!0),a.onload=function(){var d=JSON.parse(a.responseText);if(d&&d.languages){var e=b("<ul />").appendTo(c.opts.elm.wrapper.overview.children("div"));d.languages.sort(function(a,b){return b.varsAmount-a.varsAmount});var f=Object.assign({},c.languages);d.languages.forEach(function(a){if(delete f[a.name],c.languages[a.name]){var g=12*Math.PI*2,h=a.varsAmount/d.varsAmount*100;b("<li />").data("lang",a.name).append("<strong>"+c.languages[a.name]+"</strong>").append("<a href='#' class='"+c.opts.classes.edit+"' title='"+c.helper.i18n.get("translation_edit")+"'></a>").append("<svg class="+c.opts.classes.progress+" width='32' height='32' viewPort='0 0 16 16'><circle r='12' cx='16' cy='16'></circle><circle r='12' cx='16' cy='16' stroke-dashoffset='"+(100-h)/100*g+"' stroke-dasharray='"+g+"'></circle></svg>").append("<span class='"+c.opts.classes.progress+"'>"+Math.round(a.varsAmount/d.varsAmount*100)+"%</span>").appendTo(e)}});var g=b("<select class='"+c.opts.classes.languagesSelect+"' />").appendTo(c.opts.elm.wrapper.overview.children("div"));b("<option value='' />").text("Add language").appendTo(g),Object.keys(f).forEach(function(a){b("<option value='"+a+"' />").text(c.languages[a]).appendTo(g)})}n(),i()},a.send()},k=function b(d,e){var f=new XMLHttpRequest;f.open("POST",c.opts.ajax.langvars,!0),f.onload=function(){var g=JSON.parse(f.responseText);if(g&&Object.getOwnPropertyNames(g).length>0){var h=a({},d,g),i=c.opts.manifest.default_locale;d!==i?b(i,function(a){h.default=a[i],"function"==typeof e&&e(h)}):"function"==typeof e&&e(h)}else e(null)};var g=new FormData;g.append("lang",d),f.send(g)},l=function(a){c.opts.elm.wrapper.langvars.data("lang",a),c.opts.elm.wrapper.langvars.find("div."+c.opts.classes.langVarCategory).remove(),c.opts.elm.wrapper.langvars.find("> header > h2").text(""),g("langvars"),h(),k(a,function(d){if(d){var e=d[a],f=0;Object.keys(e).forEach(function(a){var g=b("<div />").addClass(c.opts.classes.langVarCategory).append("<a href='#' />").append("<strong>"+a+"</strong>").appendTo(c.opts.elm.wrapper.langvars.children("div")),h=b("<ul />").appendTo(g),i={total:e[a].length,filled:0};e[a].forEach(function(e,g){e.value&&(i.filled++,f++);var j=b("<li />").append("<label>"+e.label+"</label>").appendTo(h);d.default&&d.default[a]&&d.default[a][g]&&b("<span />").html("<span>"+c.languages[c.opts.manifest.default_locale]+":</span>"+d.default[a][g].value||"").appendTo(j);var k=e.value||"";b("<textarea />").data({initial:k,name:e.name}).text(k).appendTo(j)}),b("<span />").html("<span>"+i.filled+"</span>/"+i.total).insertBefore(h)}),c.opts.elm.wrapper.langvars.find("> header > h2").text(c.helper.i18n.get("translation_"+(0===f?"add":"edit"))+" ("+c.languages[a]+")"),o()}else g("overview");i()})},m=function(){c.opts.elm.backToOverview.on("click",function(a){a.preventDefault(),g("overview")}),c.opts.elm.save.on("click",function(a){a.preventDefault();var d=c.helper.template.loading().appendTo(c.opts.elm.body);c.opts.elm.body.addClass(c.opts.classes.loading);var e={};c.opts.elm.wrapper.langvars.find("textarea").forEach(function(a){var c=a.value;if(c&&c.trim().length>0){var d=b(a).data("initial");if((c=c.trim())!==d){var f=b(a).data("name");e[f]=c}}});var f=new XMLHttpRequest;f.open("POST",c.opts.ajax.submit,!0),f.onload=function(){var a=JSON.parse(f.responseText);console.log(a),d.remove(),c.opts.elm.body.attr(c.opts.attr.success,c.helper.i18n.get("translation_submit_message")),c.opts.elm.body.addClass(c.opts.classes.success),setTimeout(function(){c.opts.elm.body.removeClass(c.opts.classes.loading),c.opts.elm.body.removeClass(c.opts.classes.success),location.reload(!0)},1500)};var g=new FormData;g.append("lang",c.opts.elm.wrapper.langvars.data("lang")),g.append("vars",JSON.stringify(e)),f.send(g)})},n=function(){c.opts.elm.wrapper.overview.find("select."+c.opts.classes.languagesSelect).on("change",function(a){l(a.currentTarget.value)}),c.opts.elm.wrapper.overview.find("a."+c.opts.classes.edit).on("click",function(a){a.preventDefault(),l(b(a.currentTarget).parent("li").data("lang"))})},o=function(){c.opts.elm.wrapper.langvars.find("div."+c.opts.classes.langVarCategory+" > a").on("click",function(a){a.preventDefault(),b(a.currentTarget).parent().toggleClass(c.opts.classes.active)}),c.opts.elm.wrapper.langvars.find("textarea").on("change input",function(a){a.preventDefault();var d=b(a.currentTarget).parents("div."+c.opts.classes.langVarCategory).eq(0),e=0;d.find("textarea").forEach(function(a){a.value&&a.value.trim().length>0&&e++}),d.find("> span > span").text(e)})}},(new window.translation).run()}(jsu);