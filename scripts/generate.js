
var fs = require("q-io/fs");

module.exports = generate;
function generate(gitFs) {
    return gitFs.makeTree("docs")
    .then(function () {
        return fs.copyTree(fs.join(__dirname, "..", "docs"), "docs", gitFs);
    });
}

