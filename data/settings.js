/// <reference path="../../typings/jquery/jquery.d.ts"/>
/// <reference path="../../typings/showdown/showdown.d.ts"/>

$(document).ready(function () {
    //Send message to page from add-on
    self.port.on("currentmenuitems", function (menuItems) {
        var bookmarkItems = '';
        if (menuItems.length == 0) {
            bookmarkItems = '<li id="nobookmarkfound" class="bookmark-menu-item"><img class="bookmark-menu-item-image" src="chrome://mozapps/skin/places/defaultFavicon.png"/>No searchable bookmark found!</li>';
        } else {
            $.each(menuItems, function (index, value) {
                var template = '<li id="{identity}_{index}" class="bookmark-menu-item"><img class="bookmark-menu-item-image" src="{favicon}"/>{title}</li>';
                var template01 = template.replace("{identity}", value.identity);
                template01 = template01.replace("{index}", index);
                template01 = template01.replace("{favicon}", value.favicon);
                formattedBokmarkItem = template01.replace("{title}", value.title);
                bookmarkItems += formattedBokmarkItem;
            });
        }
        $(bookmarkItems).appendTo($("#sortable"));
    });

    //Send message to add-on from page
    $(document.body).on("click", "#btnSave", function (evt) {
        evt.preventDefault();
        var result = $("#sortable").sortable('toArray');
        self.port.emit("btnSave", result);
        $('#saveModal').modal('show');
    });

    $("ul, li").disableSelection();
    $(".list-group a").click(function () {
        $(".list-group-item.active").removeClass("active");
        $(this).addClass("active");
    });

    $("#sortable").sortable({
        revert: true
    });

    // to-do: use this for adding separators
    // $( "#draggable" ).draggable({
    //   connectToSortable: "#sortable",
    //   helper: "clone",
    //   revert: "invalid"
    // });

    if (location.hash.length > 0)
        $("#menu a[href='" + location.hash + "']").tab("show");

    self.port.on("addonversion", function (version) {
        $("#about-extension-version").text(version);
    });

    loadChangelog();
});

function loadChangelog() {
    $.ajax({
        url: "../changelog.md",
        dataType: "text",
        success: function (text) {
            var converter = new showdown.Converter();
            var html = converter.makeHtml(text);
            $("#changelog-content").html(html);
        }
    });
}
