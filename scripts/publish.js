
var path = require("path");
var GitFs = require("q-git/fs");
var generate = require("./generate");
var fs = require("q-io/fs");

var repo = {};
repo.rootPath = path.join(__dirname, "..", ".git");
require("git-node-fs/mixins/fs-db")(repo, repo.rootPath);
require('js-git/mixins/create-tree')(repo);
require('js-git/mixins/pack-ops')(repo);
require('js-git/mixins/walkers')(repo);
require('js-git/mixins/read-combiner')(repo);
require('js-git/mixins/formats')(repo);

var gitFs = new GitFs(repo);

gitFs.load("refs/remotes/origin/gh-pages")
.then(function () {
    return gitFs.removeTree("/");
})
.then(function () {
    return generate(gitFs);
})
.then(function () {
    return gitFs.commit({
        author: {name: "Git Bot", email: "kris@cixar.com"},
        message: "Build"
    })
})
.then(function () {
    return gitFs.saveAs("refs/heads/gh-pages");
})
.done();

