#!/usr/bin/env node

"use strict";

var fs = require("fs");
var path = require("path");
var Augur = require("../src");

Augur = require("../src/utilities").setup(Augur, process.argv.slice(2));

var log = console.log;

Augur.dispatch({
    branchId: Augur.branches.dev,
    onSent: function (r) {
        log("dispatch sent:", r.callReturn);
    },
    onSuccess: function (r) {
        log("dispatch success:", r);
    },
    onFailed: function (r) {
        throw r.message;
    }
});
