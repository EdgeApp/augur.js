/**
 * augur.js tests
 * @author Jack Peterson (jack@tinybike.net)
 */

"use strict";

var runner = require("../runner");

describe("Unit tests", function () {
    describe("eth_call", function () {
        runner(this.title, [{
            method: "getCashBalance",
            parameters: ["address"]
        }]);
    });
    describe("eth_sendTransaction", function () {
        runner(this.title, [{
            method: "setCash",
            parameters: ["address", "fixed"]
        }, {
            method: "addCash",
            parameters: ["address", "fixed"]
        }, {
            method: "initiateOwner",
            parameters: ["address"]
        }, {
            method: "sendCash",
            parameters: ["address", "fixed"]
        }, {
            method: "sendCashFrom",
            parameters: ["address", "fixed", "address"]
        }, {
            method: "withdrawEther",
            parameters: ["address", "ether"]
        }]);
    });
});