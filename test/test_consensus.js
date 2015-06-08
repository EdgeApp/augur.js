/**
 * augur.js unit tests
 * @author Jack Peterson (jack@tinybike.net)
 */

"use strict";

var BigNumber = require("bignumber.js");
var assert = require("assert");
var Augur = require("../augur");
var _ = require("lodash");
var constants = require("./constants");

require('it-each')({ testPerIteration: true });

Augur.connect();

var log = console.log;
var TIMEOUT = 120000;

var amount = "1";
var branch = Augur.branches.dev;
var branch_number = "1";
var participant_id = Augur.coinbase;
var participant_number = "1";
var outcome = Augur.NO.toString();
var reporter_index = "0";
var reporter_address = Augur.coinbase;
var salt = "1010101";

var period = Augur.getVotePeriod(branch);
var num_events = Augur.getNumberEvents(branch, period);
var num_reports = Augur.getNumberReporters(branch);
var step = Augur.getStep(branch);
var substep = Augur.getSubstep(branch);
var num_events = Augur.getNumberEvents(branch, period);
var num_reports = Augur.getNumberReporters(branch);
var flatsize = num_events * num_reports;
var ballot = new Array(num_events);

describe("Test PCA consensus", function () {
    it("interpolate", function (done) {
        this.timeout(TIMEOUT);

        Augur.setStep(branch, 0);
        Augur.setSubstep(branch, 0);

        var reputation = Augur.getRepBalance(branch, Augur.coinbase);
        var rep_new = Augur.getRepBalance(branch, constants.chain10101.accounts.tinybike_new);
        var reports = new Array(flatsize);
        for (var i = 0; i < num_reports; ++i) {
            var getballot = Augur.getReporterBallot(branch, period, Augur.getReporterID(branch, i));
            if (getballot[0] != 0) {
                for (var j = 0; j < num_events; ++j) {
                    reports[i*num_events + j] = getballot[j];
                }
            }
        }
        // log(Augur.unfix(reports, "string"));

        Augur.tx.redeem_interpolate.send = false;
        var retval = Augur.redeem_interpolate(branch, period, num_events, num_reports, flatsize);
        assert.equal(retval, "0x01");

        var reports_filled = Augur.getReportsFilled(branch, period);
        for (var i = 0; i < num_events; ++i) {
            // assert.equal(reports_filled[i], Augur.fix(ballot[i], "string"));
        }
        var reports_mask = Augur.getReportsMask(branch, period);
        for (var i = 0; i < num_events; ++i) {
            // assert.equal(reports_mask[i], "0");
        }
        var v_size = Augur.getVSize(branch, period);
        // assert.equal(v_size, num_reports * num_events);

        done();
    });

    var label = "dispatch " + Augur.getStep(branch) + " (" + Augur.getSubstep(branch) + ")";
    it(label, function (done) {
        this.timeout(TIMEOUT);
        Augur.dispatch({
            branchId: branch,
            period: period,
            onSent: function (r) {
                log("sent:", r);
            },
            onSuccess: function (r) {
                log("success:", r);
                log("step:     ", Augur.getStep(branch));
                log("substep:  ", Augur.getSubstep(branch));
                done();
            },
            onFailed: function (r) {
                log("failed:", r);
                log("step:     ", Augur.getStep(branch));
                log("substep:  ", Augur.getSubstep(branch));
                done();
            }
        });
    });
});