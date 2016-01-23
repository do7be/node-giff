require('diff2html');

document.addEventListener("DOMContentLoaded", function() {
    var diffJson = Diff2Html.getJsonFromDiff(lineDiffExample);
    var allFileLanguages = diffJson.map(function(line) {
        return line.language;
    });

    var distinctLanguages = allFileLanguages.filter(function(v, i) {
        return allFileLanguages.indexOf(v) == i;
    });

    hljs.configure({languages: distinctLanguages});

    document.getElementById("line-by-line").innerHTML = Diff2Html.getPrettyHtml(diffJson, { inputFormat: 'json', showFiles: true, matching: 'lines' });
    document.getElementById("side-by-side").innerHTML = Diff2Html.getPrettyHtml(diffJson, { inputFormat: 'json', showFiles: true, matching: 'lines', outputFormat: 'side-by-side' });

    var codeLines = document.getElementsByClassName("d2h-code-line-ctn");
    [].forEach.call(codeLines, function(line) {
        hljs.highlightBlock(line);
    });
});
