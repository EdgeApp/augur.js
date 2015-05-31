/**
 * JavaScript bindings for the Augur API
 * @author Jack Peterson (jack@tinybike.net)
 */

"use strict";

var MODULAR = (typeof(module) !== 'undefined');
var NODE_JS = MODULAR && process && !process.browser;
if (MODULAR) {
    if (NODE_JS) {
        var httpsync;
        try {
            httpsync = require('http-sync');
        } catch (e) {
            httpsync = require('http-sync-win');
        }
        var XHR2 = require('xhr2');
    }
    var keccak_256 = require('js-sha3').keccak_256;
    var BigNumber = require('bignumber.js');
}

var Augur = (function (augur) {

    BigNumber.config({ MODULO_MODE: BigNumber.EUCLID });

    // default RPC settings
    augur.RPC = {
        protocol: "http",
        host: "localhost",
        port: 8545
    };

    // default gas: 3M
    augur.default_gas = "0x2dc6c0";

    // if set to true, all numerical results (including hashes)
    // are returned as BigNumber objects
    augur.BigNumberOnly = false;

    // max number of tx verification attempts
    augur.TX_POLL_MAX = 12;

    // comment polling interval (in milliseconds)
    augur.COMMENT_POLL_INTERVAL = 10000;

    // transaction polling interval
    augur.TX_POLL_INTERVAL = 6000;

    // constants
    augur.MAXBITS = (new BigNumber(2)).toPower(256);
    augur.MAXNUM = (new BigNumber(2)).toPower(255);
    augur.ONE = (new BigNumber(2)).toPower(64);
    augur.TWO = (new BigNumber(2)).toPower(65);
    augur.BAD = ((new BigNumber(2)).toPower(63)).mul(new BigNumber(3));
    augur.ETHER = (new BigNumber(10)).toPower(18);
    augur.AGAINST = augur.NO = 1; // against: "won't happen"
    augur.ON = augur.YES = 2;     // on: "will happen"

    augur.id = 1;
    augur.data = {};

    // contract error codes
    augur.ERRORS = {
        "0x": "no response or bad input",
        getSimulatedBuy: {
            "-2": "cost updating error (did you enter a valid quantity?)"
        },
        closeMarket: {
            "-1": "market has no cash",
            "-2": "0 outcome",
            "-3": "outcome indeterminable"
        },
        report: {
            "0": "could not set reporter ballot",
            "-1": "report length does not match number of expiring events",
            "-2": "voting period expired",
            "-3": "incorrect hash"
        },
        submitReportHash: {
            "0": "could not set report hash",
            "-1": "reporter doesn't exist, voting period is over, or voting "+
                "period hasn't started yet",
            "-2": "not in hash submitting timeframe"
        },
        checkReportValidity: {
            "-1": "report isn't long enough",
            "-2": "reporter doesn't exist, voting period is over, or voting "+
                "period hasn't started yet"
        },
        slashRep: {
            "0": "incorrect hash",
            "-2": "incorrect reporter ID"
        },
        createEvent: {
            "0": "not enough money to pay fees or event already exists",
            "-1": "we're either already past that date, branch doesn't "+
                "exist, or description is bad"
        },
        createMarket: {
            "-1": "bad input or parent doesn't exist",
            "-2": "too many events",
            "-3": "too many outcomes",
            "-4": "not enough money or market already exists"
        },
        dispatch: {
            "-1": "quorum not met"
        },
        sendReputation: {
            "0": "not enough reputation",
            "-1": "Your reputation account was just created! Earn some "+
                "reputation before you can send to others",
            "-2": "Receiving address doesn't exist"
        },
        buyShares: {
            "-1": "invalid outcome or trading closed",
            "-2": "entered a negative number of shares",
            "-3": "not enough money",
            "-4": "bad nonce/hash"
        }
    };
    augur.ERRORS.getSimulatedSell = augur.ERRORS.getSimulatedBuy;
    augur.ERRORS.sellShares = augur.ERRORS.buyShares;

    /**********************
     * Contract addresses *
     **********************/

    augur.contracts = {

        // Functions
        checkQuorum: "0x7c349cc8658e399a01f80019f46bd7644dc97adb",
        buyAndSellShares: "0xd3ac3ce511d6d9bdacb9679b85dc67e61dd06eb3",
        createBranch: "0x99384f3bdd17031c6989ff70cbe14c044f158f38",
        p2pWagers: "0x84bb069b2569683990dbebc0b0e2cad737aafc9c",
        sendReputation: "0x54ed0a8df07492a4849bf95f7b7546c01fd424c4",
        transferShares: "0x87dfd27bb4d90e483b9135953af22cd0c39bfbbe",
        makeReports: "0xcc4f04ab3ebbc687f1ff8744387c506120172414",
        createEvent: "0x68ca53bade0eaad0d86cfc882629bef830321fbc",
        createMarket: "0xc2c05c50f1df4e7abd2948ed3ce062e33941abda",
        closeMarket: "0x35c3f4d503757751e01324d7da94dc2753fcc139",
        closeMarketOne: "0xcbd4763be1ce8a957c3468eb5cb7b7bcbde8409c",
        closeMarketTwo: "0xb840c8ed2063a86b950c9257b133dc416ae7f8f1",
        closeMarketFour: "0x652f9bfcdbca9be878bd871887daeb07643eb015",
        closeMarketEight: "0xfbc3d545430b73168d80342af66c6a107e75a9b6",
        dispatch: "0xd654a3d8b789f378e87321334644235081866251",

        // Consensus
        statistics: "0x3bf005562f0bc9854329fe5976a64ecca869298b",
        interpolate: "0x554bb0bafa1760d17ebec20c667773f5a86f0ce4",
        center: "0x357938a55923451c8485fab9f7d148f53fa1005d",
        score: "0x8c49af1fbd2d5bfbe2e9f1392cd32fc43419e028",
        adjust: "0x5fb166f1c390f7c48253876abe9a342a4a4ad9bd",
        resolve: "0x01329dc6cf3eeb7409f309f136a944064e04bacb",
        payout: "0x07e41da61e7c629ae33982df4c01f087a08642a5",
        redeem_interpolate: "0x499bee78b5799ede28a437467601cdfd5f9f2076",
        redeem_center: "0x6621d0c3c37fea879ce067f5e85c80f08ffa5e7f",
        redeem_score: "0x238ea089e5f7bdc776d7a995f4c0a4e37c36ea37",
        redeem_adjust: "0x6d5793203371b50670aa62a558a44d99aceb1404",
        redeem_resolve: "0x081f48cd8ba8eaef5c7ade0d8e771555fccaeb4b",
        redeem_payout: "0xb612eb2dc2be63445e541eaad4906580cff1557e",

        // Data and api
        cash: "0x3c99d4851b17df03655a42a3046035519f75469d",
        info: "0xd46714c7b4bc8dc8af40ec8ea23207221c31c841",
        branches: "0x3bc4532769424b380037df6f94ba52ed72636b7f",
        events: "0xfdefa42a3209d3f320b220a234cd0cdea5e761f8",
        expiringEvents: "0xf97d9fdba23823b2796446d4a45e18a7a1fdf905",
        fxMath: "0x39b6041fec3b25fd398bf1b03bb6d52e58f59809",
        markets: "0x10614b8d158b5b122ff4eaa362606ec0909cd822",
        reporting: "0xbe774ec2c537ea1a4981529568060456a650d639",
        whitelist: "0xd93ea5e50aad9442574a5613e800ff9c8236622d"
    };

    // Branch IDs
    augur.branches = {
        demo: '0x00000000000000000000000000000000000000000000000000000000000f69b5',
        alpha: '0x00000000000000000000000000000000000000000000000000000000000f69b5',
        dev: '0x00000000000000000000000000000000000000000000000000000000000f69b5'
    };

    /*********************
     * Utility functions *
     *********************/

    function log(msg) {
        var output = "[augur.js] ";
        if (msg) {
            if (msg.constructor === Object || msg.constructor === Array) {
                output += JSON.stringify(msg, null, 2);
            } else {
                output += msg.toString();
            }
            console.log(output);
        }
    }
    function copy(obj) {
        if (null === obj || "object" !== typeof obj) return obj;
        var clone = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) clone[attr] = obj[attr];
        }
        return clone;
    }
    function has_value(o, v) {
        for (var p in o) {
            if (o.hasOwnProperty(p)) {
                if (o[p] === v) {
                    return p;
                }
            }
        }
    }
    augur.loop = function(list, iterator) {
        var n = list.length;
        var i = -1;
        var calls = 0;
        var looping = false;
        var iterate = function () {
            calls -= 1;
            i += 1;
            if (i === n) return;
            iterator(list[i], next);
        };
        var runloop = function () {
            if (looping) return;
            looping = true;
            while (calls > 0) iterate();
            looping = false;
        };
        var next = function () {
            calls += 1;
            if (typeof setTimeout === 'undefined') runloop();
            else setTimeout(iterate, 1);
        };
        next();
    };

    /**************************
     * Fixed-point conversion *
     **************************/

    augur.prefix_hex = function (n) {
        if (n.constructor === Number || n.constructor === BigNumber) {
            n = n.toString(16);
        }
        if (n.slice(0,2) !== "0x" && n.slice(0,3) !== "-0x") {
            if (n.slice(0,1) === '-') {
                n = "-0x" + n.slice(1);
            } else {
                n = "0x" + n;
            }
        }
        return n;
    };
    augur.bignum = function (n, compact) {
        var bn;
        if (n !== null && n !== undefined && n !== "0x") {
            if (n.constructor === Number) {
                if (Math.floor(Math.log(n) / Math.log(10) + 1) <= 15) {
                    bn = new BigNumber(n);
                } else {
                    n = n.toString();
                    try {
                        bn = new BigNumber(n);
                    } catch (exc) {
                        if (n.slice(0,1) === '-') {
                            bn = new BigNumber("-0x" + n.slice(1));
                        }
                        bn = new BigNumber("0x" + n);
                    }
                }
            } else if (n.constructor === String) {
                try {
                    bn = new BigNumber(n);
                } catch (exc) {
                    if (n.slice(0,1) === '-') {
                        bn = new BigNumber("-0x" + n.slice(1));
                    }
                    bn = new BigNumber("0x" + n);
                }
            } else if (n.constructor === BigNumber) {
                bn = n;
            }
            if (bn && bn.gt(augur.MAXNUM)) {
                bn = bn.sub(augur.MAXBITS);
            }
            if (compact) {
                var cbn = bn.sub(augur.MAXBITS);
                if (bn.toString(16).length > cbn.toString(16).length) {
                    bn = cbn;
                }
            }
            return bn;
        } else {
            return n;
        }
    };
    augur.fix = function (n, encode) {
        var fixed;
        if (n && n !== "0x") {
            if (encode) encode = encode.toLowerCase();
            if (n.constructor === Array) {
                var len = n.length;
                fixed = new Array(len);
                for (var i = 0; i < len; ++i) {
                    fixed[i] = augur.fix(n[i], encode);
                }
            } else {
                if (n.constructor === BigNumber) {
                    fixed = n.mul(augur.ONE).round();
                } else {
                    fixed = augur.bignum(n).mul(augur.ONE).round();
                }
                if (fixed && fixed.gt(augur.MAXNUM)) {
                    fixed = fixed.sub(augur.MAXBITS);
                }
                if (encode) {
                    if (encode === "string") {
                        fixed = fixed.toFixed();
                    } else if (encode === "hex") {
                        fixed = augur.prefix_hex(fixed);
                    }
                }
            }
            return fixed;
        } else {
            return n;
        }
    };
    augur.unfix = function (n, encode) {
        var unfixed;
        if (n && n !== "0x") {
            if (encode) encode = encode.toLowerCase();
            if (n.constructor === Array) {
                var len = n.length;
                unfixed = new Array(len);
                for (var i = 0; i < len; ++i) {
                    unfixed[i] = augur.unfix(n[i], encode);
                }
            } else {
                if (n.constructor === BigNumber) {
                    unfixed = n.dividedBy(augur.ONE);
                } else {
                    unfixed = augur.bignum(n).dividedBy(augur.ONE);
                }
                if (encode) {
                    if (encode === "hex") {
                        unfixed = augur.prefix_hex(unfixed);
                    } else if (encode === "string") {
                        unfixed = unfixed.toFixed();
                    } else if (encode === "number") {
                        unfixed = unfixed.toNumber();
                    }
                }
            }
            return unfixed;
        } else {
            return n;
        }
    };

    /***********************************
     * Contract ABI data serialization *
     ***********************************/

    function encode_int(value) {
        var cs = [];
        var x = new BigNumber(value);
        while (x.gt(new BigNumber(0))) {
            cs.push(String.fromCharCode(x.mod(new BigNumber(256))));
            x = x.dividedBy(new BigNumber(256)).floor();
        }
        return (cs.reverse()).join('');
    }
    function remove_leading_zeros(h) {
        var hex = h.toString();
        if (hex.slice(0, 2) === "0x") {
            hex = hex.slice(2);
        }
        if (!/^0+$/.test(hex)) {
            while (hex.slice(0, 2) === "00") {
                hex = hex.slice(2);
            }
        }
        return hex;
    }
    function remove_trailing_zeros(h) {
        var hex = h.toString();
        while (hex.slice(-2) === "00") {
            hex = hex.slice(0,-2);
        }
        return hex;
    }
    augur.encode_hex = function (str) {
        var hexbyte, hex = '';
        for (var i = 0, len = str.length; i < len; ++i) {
            hexbyte = str.charCodeAt(i).toString(16);
            if (hexbyte.length === 1) hexbyte = "0" + hexbyte;
            hex += hexbyte;
        }
        return hex;
    };
    augur.decode_hex = function (h, strip) {
        var hex = h.toString();
        var str = '';
        // first 32 bytes = new ABI offset
        if (strip) {
            if (h.slice(0,2) === "0x") h = h.slice(2);
            h = h.slice(64);
        }
        hex = remove_leading_zeros(h);
        // remove leading byte(s) = string length
        if (strip) {
            var len = hex.length;
            if (len > 16777215) {     // leading 4 bytes if > 16777215
                hex = hex.slice(8);
            } else if (len > 65540) { // leading 3 bytes if > 65535
                hex = hex.slice(6);
            } else if (len > 259) {   // leading 2 bytes if > 255
                hex = hex.slice(4);
            } else {
                hex = hex.slice(2);
            }
            hex = remove_trailing_zeros(hex);
        }
        for (var i = 0, l = hex.length; i < l; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return str;
    };
    function pad_right(s) {
        var output = s;
        while (output.length < 64) {
            output += '0';
        }
        return output;
    }
    function pad_left(r, ishex) {
        var output = r;
        if (!ishex) output = augur.encode_hex(output);
        while (output.length < 64) {
            output = '0' + output;
        }
        return output;
    }
    augur.get_prefix = function(funcname, signature) {
        signature = signature || "";
        var summary = funcname + "(";
        for (var i = 0, len = signature.length; i < len; ++i) {
            switch (signature[i]) {
                case 's':
                    summary += "bytes";
                    break;
                case 'i':
                    summary += "int256";
                    break;
                case 'a':
                    summary += "int256[]";
                    break;
                default:
                    summary += "weird";
            }
            if (i !== len - 1) summary += ",";
        }
        var prefix = keccak_256(summary + ")").slice(0, 8);
        while (prefix.slice(0, 1) === '0') {
            prefix = prefix.slice(1);
        }
        return "0x" + prefix;
    };

    /********************************
     * Parse Ethereum response JSON *
     ********************************/

    function parse_array(string, returns, stride, init) {
        var elements, array, position;
        if (string.length >= 66) {
            stride = stride || 64;
            elements = (string.length - 2) / stride;
            array = new Array(elements);
            position = init || 2;
            for (var i = 0; i < elements; ++i) {
                array[i] = augur.prefix_hex(string.slice(position, position + stride));
                position += stride;
            }
            if (array.length) {
                if (parseInt(array[0]) === array.length - 1) {
                    array.splice(0, 1);
                } else if (parseInt(array[1]) === array.length - 2) {
                    array.splice(0, 2);
                }
            }
            for (i = 0; i < array.length; ++i) {
                if (returns === "hash[]" && augur.BigNumberOnly) {
                    array[i] = augur.bignum(array[i]);
                } else {
                    if (returns === "number[]") {
                        if (augur.BigNumberOnly) {
                            array[i] = augur.unfix(array[i]);
                        } else {
                            array[i] = augur.unfix(array[i], "string");
                        }
                    }
                }
            }
            return array;
        } else {
            // expected array, got scalar error code
            return string;
        }
    }
    function format_result(returns, result) {
        returns = returns.toLowerCase();
        if (result && result !== "0x") {
            if (returns && returns.slice(-2) === "[]") {
                result = parse_array(result, returns);
            } else if (returns === "string") {
                result = augur.decode_hex(result, true);
            } else {
                if (augur.BigNumberOnly) {
                    if (returns === "unfix") {
                        result = augur.unfix(result);
                    }
                    if (result.constructor !== BigNumber) {
                        result = augur.bignum(result);
                    }
                } else {
                    if (returns === "number") {
                        result = augur.bignum(result).toFixed();
                    } else if (returns === "bignumber") {
                        result = augur.bignum(result);
                    } else if (returns === "unfix") {
                        result = augur.unfix(result, "string");
                    }
                }
            }
        }
        return result;
    }

    function parse(response, returns, callback) {
        var results, len;
        try {
            if (response !== undefined) {
                response = JSON.parse(response);
                if (response.error) {
                    response = {
                        error: response.error.code,
                        message: response.error.message
                    };
                    if (callback) {
                        callback(response);
                    } else {
                        return response;
                    }
                } else if (response.result !== undefined) {
                    if (returns) {
                        response.result = format_result(returns, response.result);
                    } else {
                        if (response.result && response.result.length > 2 && response.result.slice(0,2) === "0x") {
                            response.result = remove_leading_zeros(response.result);
                            response.result = augur.prefix_hex(response.result);
                        }
                    }
                    // if (augur.BigNumberOnly) {
                    //     response.result = augur.bignum(response.result);
                    // }
                    if (callback) {
                        callback(response.result);
                    } else {
                        return response.result;
                    }
                } else if (response.constructor === Array && response.length) {
                    len = response.length;
                    results = new Array(len);
                    for (var i = 0; i < len; ++i) {
                        if (response.error) {
                            console.error(
                                "[" + response.error.code + "]",
                                response.error.message
                            );
                        } else if (response[i].result !== undefined) {
                            if (returns[i]) {
                                results[i] = format_result(returns[i], response[i].result);
                            }
                        }
                    }
                    if (callback) {
                        callback(results);
                    } else {
                        return results;
                    }
                } else { // no result or error field :(
                    if (callback) {
                        callback(response);
                    } else {
                        return response;
                    }
                }
            }
        } catch (e) {
            if (callback) {
                callback(e);
            } else {
                return e;
            }
        }
    }

    /********************************************
     * Post JSON-RPC command to Ethereum client *
     ********************************************/

    function strip_returns(tx) {
        var returns;
        if (tx.params && tx.params.length && tx.params[0] && tx.params[0].returns) {
            returns = tx.params[0].returns;
            delete tx.params[0].returns;
        }
        return returns;
    }
    function json_rpc(command, callback) {
        var protocol, host, port, rpc_url, num_commands, returns, req = null;
        protocol = augur.RPC.protocol || "http";
        host = augur.RPC.host || "localhost";
        port = augur.RPC.port || "8545";
        rpc_url = protocol + "://" + host + ":" + port;
        if (command.constructor === Array) {
            num_commands = command.length;
            returns = new Array(num_commands);
            for (var i = 0; i < num_commands; ++i) {
                returns[i] = strip_returns(command[i]);
            }
        } else {
            returns = strip_returns(command);
        }
        command = JSON.stringify(command);
        if (NODE_JS) {
            // asynchronous if callback exists
            if (callback && callback.constructor === Function) {
                req = new XHR2();
                req.onreadystatechange = function () {
                    if (req.readyState === 4) {
                        parse(req.responseText, returns, callback);
                    }
                };
                req.open("POST", rpc_url, true);
                req.setRequestHeader("Content-type", "application/json");
                req.send(command);
            } else {
                req = httpsync.request({
                    protocol: protocol,
                    host: host,
                    path: '/',
                    port: port,
                    method: 'POST'
                });
                req.write(command);
                return parse((req.end()).body.toString(), returns);
            }
        } else {
            if (window.XMLHttpRequest) {
                req = new window.XMLHttpRequest();
            } else {
                req = new window.ActiveXObject("Microsoft.XMLHTTP");
            }
            if (callback && callback.constructor === Function) {
                req.onreadystatechange = function () {
                    if (req.readyState === 4) {
                        parse(req.responseText, returns, callback);
                    }
                };
                req.open("POST", rpc_url, true);
                req.setRequestHeader("Content-type", "application/json");
                req.send(command);
            } else {
                req.open("POST", rpc_url, false);
                req.setRequestHeader("Content-type", "application/json");
                req.send(command);
                return parse(req.responseText, returns);
            }
        }
    }
    function postdata(command, params, prefix) {
        augur.data = {
            id: augur.id++,
            jsonrpc: "2.0"
        };
        if (prefix === "null") {
            augur.data.method = command.toString();
        } else {
            augur.data.method = (prefix || "eth_") + command.toString();
        }
        if (params) {
            if (params.constructor === Array) {
                augur.data.params = params;
            } else {
                augur.data.params = [params];
            }
        } else {
            augur.data.params = [];
        }
        return augur.data;
    }

    /*******************************
     * Ethereum network connection *
     *******************************/

    augur.connect = function (rpcinfo) {
        var rpc, key;
        if (rpcinfo) {
            if (rpcinfo.constructor === Object) {
                if (rpcinfo.protocol) augur.RPC.protocol = rpcinfo.protocol;
                if (rpcinfo.host) augur.RPC.host = rpcinfo.host;
                if (rpcinfo.port) {
                    augur.RPC.port = rpcinfo.port;
                } else {
                    rpc = rpcinfo.host.split(":");
                    if (rpc.length === 2) {
                        augur.RPC.host = rpc[0];
                        augur.RPC.port = rpc[1];
                    }
                }
            } else if (rpcinfo.constructor === String) {
                try {
                    rpc = rpcinfo.split("://");
                    console.assert(rpc.length === 2);
                    augur.RPC.protocol = rpc[0];
                    rpc = rpc[1].split(':');
                    if (rpc.length === 2) {
                        augur.RPC.host = rpc[0];
                        augur.RPC.port = rpc[1];
                    } else {
                        augur.RPC.host = rpc;
                    }
                } catch (e) {
                    try {
                        rpc = rpcinfo.split(':');
                        if (rpc.length === 2) {
                            augur.RPC.host = rpc[0];
                            augur.RPC.port = rpc[1];
                        } else {
                            augur.RPC.host = rpc;
                        }
                    } catch (exc) {
                        return false;
                    }
                }
            }
        } else {
            augur.RPC = {
                protocol: "http",
                host: "localhost",
                port: 8545
            };
        }
        try {
            augur.coinbase = json_rpc(postdata("coinbase"));
            if (augur.coinbase && augur.coinbase !== "0x") {
                for (var method in augur.tx) {
                    if (!augur.tx.hasOwnProperty(method)) continue;
                    augur.tx[method].from = augur.coinbase;
                    key = has_value(augur.init_contracts, augur.tx[method].to);
                    if (key) augur.tx[method].to = augur.contracts[key];
                }
            }
            augur.init_contracts = copy(augur.contracts);
            return true;
        } catch (exc) {
            return false;
        }
    };
    augur.setCoinbase = function (repeat) {
        try {
            augur.coinbase = json_rpc(postdata("coinbase"));
        } catch (e) {
            var delay = 5000 * repeat;
            log("connection error, retrying in " + parseInt(delay / 1000).toString() + " seconds");
            if (repeat && repeat < 3) {
                setTimeout(function () { augur.setCoinbase(repeat + 1); }, delay);
            }
        }
    };

    /******************************
     * Ethereum JSON-RPC bindings *
     ******************************/

    augur.rpc = function (command, params, f) {
        return json_rpc(postdata(command, params, "null"), f);
    };
    augur.eth = function (command, params, f) {
        return json_rpc(postdata(command, params), f);
    };
    augur.net = function (command, params, f) {
        return json_rpc(postdata(command, params, "net_"), f);
    };
    augur.web3 = function (command, params, f) {
        return json_rpc(postdata(command, params, "web3_"), f);
    };
    augur.db = function (command, params, f) {
        return json_rpc(postdata(command, params, "db_"), f);
    };
    augur.shh = function (command, params, f) {
        return json_rpc(postdata(command, params, "shh_"), f);
    };
    augur.sha3 = augur.hash = function (data, f) {
        if (data) {
            if (data.constructor === Array || data.constructor === Object) {
                data = JSON.stringify(data);
            }
            return json_rpc(postdata("sha3", data.toString(), "web3_"), f);
        }
    };
    augur.gasPrice = function (f) {
        return json_rpc(postdata("gasPrice"), f);
    };
    augur.blockNumber = function (f) {
        if (f) {
            json_rpc(postdata("blockNumber"), f);
        } else {
            return parseInt(json_rpc(postdata("blockNumber")));
        }
    };
    augur.getBalance = augur.balance = function (address, block, f) {
        return json_rpc(postdata("getBalance", [address || augur.coinbase, block || "latest"]), f);
    };
    augur.getTransactionCount = augur.txCount = function (address, f) {
        return json_rpc(postdata("getTransactionCount", address || augur.coinbase), f);
    };
    augur.sendEther = augur.pay = function (to, value, from, onSent, onSuccess, onFailed) {
        var tx, txhash;
        if (to && to.value) {
            value = to.value;
            if (to.from) from = to.from;
            if (to.onSent) onSent = to.onSent;
            if (to.onSuccess) onSuccess = to.onSuccess;
            if (to.onFailed) onFailed = to.onFailed;
            to = to.to;
        }
        tx = {
            from: from || augur.coinbase,
            to: to,
            value: augur.bignum(value).mul(augur.ETHER).toFixed()
        };
        if (onSent) {
            augur.sendTx(tx, function (txhash) {
                if (txhash) {
                    onSent(txhash);
                    if (onSuccess) tx_notify(0, null, txhash, onSuccess);
                }
            });
        } else {
            txhash = augur.sendTx(tx);
            if (txhash) {
                if (onSuccess) tx_notify(0, null, txhash, onSuccess);
                return txhash;
            }
        }
    };
    augur.getTransactionByHash = augur.getTx = function (hash, f) {
        return json_rpc(postdata("getTransactionByHash", hash), f);
    };
    augur.peerCount = function (f) {
        if (f) {
            json_rpc(postdata("peerCount", [], "net_"), f);
        } else {
            return parseInt(json_rpc(postdata("peerCount", [], "net_")));
        }
    };
    augur.accounts = function (f) {
        return json_rpc(postdata("accounts"), f);
    };
    augur.mining = function (f) {
        return json_rpc(postdata("mining"), f);
    };
    augur.hashrate = function (f) {
        if (f) {
            json_rpc(postdata("hashrate"), f);
        } else {
            return parseInt(json_rpc(postdata("hashrate")));
        }
    };

    // estimate a transaction's gas cost
    augur.estimateGas = function (tx, f) {
        tx.to = tx.to || "";
        return json_rpc(postdata("estimateGas", tx), f);
    };

    // execute functions on contracts on the blockchain
    augur.call = function (tx, f) {
        tx.to = tx.to || "";
        tx.gas = (tx.gas) ? augur.prefix_hex(tx.gas.toString(16)) : augur.default_gas;
        return json_rpc(postdata("call", tx), f);
    };
    augur.sendTransaction = augur.sendTx = function (tx, f) {
        tx.to = tx.to || "";
        tx.gas = (tx.gas) ? augur.prefix_hex(tx.gas.toString(16)) : augur.default_gas;
        return json_rpc(postdata("sendTransaction", tx), f);
    };

    // publish a new contract to the blockchain (from the coinbase account)
    augur.publish = function (compiled, f) {
        return this.sendTx({ from: augur.coinbase, data: compiled }, f);
    };

    // hex-encode a function's ABI data and return it
    augur.abi_data = augur.encode_abi = function (tx) {
        tx.signature = tx.signature || "";
        var stat, statics = '';
        var dynamic, dynamics = '';
        var num_params = tx.signature.length;
        var data_abi = augur.get_prefix(tx.method, tx.signature);
        var types = [];
        for (var i = 0, len = tx.signature.length; i < len; ++i) {
            if (tx.signature[i] === 's') {
                types.push("bytes");
            } else if (tx.signature[i] === 'a') {
                types.push("int256[]");
            } else {
                types.push("int256");
            }
        }
        if (tx.params !== undefined && tx.params !== null && tx.params !== [] && tx.params !== "") {
            if (tx.params.constructor === String) {
                if (tx.params.slice(0,1) === "[" && tx.params.slice(-1) === "]") {
                    tx.params = JSON.parse(tx.params);
                }
                if (tx.params.constructor === String) {
                    tx.params = [tx.params];
                }
            } else if (tx.params.constructor === Number) {
                tx.params = [tx.params];
            }
        } else {
            tx.params = [];
        }
        if (num_params === tx.params.length) {
            for (i = 0, len = types.length; i < len; ++i) {
                if (types[i] === "int256") {
                    if (tx.params[i] !== undefined && tx.params[i] !== null && tx.params[i] !== [] && tx.params[i] !== "") {
                        if (tx.params[i].constructor === Number) {
                            stat = augur.bignum(tx.params[i]);
                            if (stat !== 0) {
                                stat = stat.mod(augur.MAXBITS).toFixed();
                            } else {
                                stat = stat.toFixed();
                            }
                            statics += pad_left(encode_int(stat));
                        } else if (tx.params[i].constructor === String) {
                            if (tx.params[i].slice(0,1) === '-') {
                                stat = augur.bignum(tx.params[i]).mod(augur.MAXBITS).toFixed();
                                statics += pad_left(encode_int(stat));
                            } else if (tx.params[i].slice(0,2) === "0x") {
                                statics += pad_left(tx.params[i].slice(2), true);
                            } else {
                                stat = augur.bignum(tx.params[i]).mod(augur.MAXBITS);
                                statics += pad_left(encode_int(stat));
                            }
                        }
                    }
                } else if (types[i] === "bytes" || types[i] === "string") {
                    // offset (in 32-byte chunks)
                    stat = 32*num_params + 0.5*dynamics.length;
                    stat = augur.bignum(stat).mod(augur.MAXBITS).toFixed();
                    statics += pad_left(encode_int(stat));
                    dynamics += pad_left(encode_int(tx.params[i].length));
                    dynamics += pad_right(augur.encode_hex(tx.params[i]));
                } else if (types[i] === "int256[]") {
                    stat = 32*num_params + 0.5*dynamics.length;
                    stat = augur.bignum(stat).mod(augur.MAXBITS).toFixed();
                    statics += pad_left(encode_int(stat));
                    var arraylen = tx.params[i].length;
                    dynamics += pad_left(encode_int(arraylen));
                    for (var j = 0; j < arraylen; ++j) {
                        if (tx.params[i][j].constructor === Number) {
                            dynamic = augur.bignum(tx.params[i][j]).mod(augur.MAXBITS).toFixed();
                            dynamics += pad_left(encode_int(dynamic));
                        } else if (tx.params[i][j].constructor === String) {
                            if (tx.params[i][j].slice(0,1) === '-') {
                                dynamic = augur.bignum(tx.params[i][j]).mod(augur.MAXBITS).toFixed();
                                dynamics += pad_left(encode_int(dynamic));
                            } else if (tx.params[i][j].slice(0,2) === "0x") {
                                dynamics += pad_left(tx.params[i][j].slice(2), true);
                            } else {
                                dynamic = augur.bignum(tx.params[i][j]).mod(augur.MAXBITS);
                                dynamics += pad_left(encode_int(dynamic));
                            }
                        }
                    }
                }
            }
            return data_abi + statics + dynamics;
        } else {
            return console.error("wrong number of parameters");
        }
    };
    /**
     * Invoke a function from a contract on the blockchain.
     *
     * Input tx format:
     * {
     *    from: <sender's address> (hexstring; optional, coinbase default)
     *    to: <contract address> (hexstring)
     *    method: <function name> (string)
     *    signature: <function signature, e.g. "iia"> (string)
     *    params: <parameters passed to the function> (optional)
     *    returns: <"number[]", "int", "BigNumber", or "string" (default)>
     *    send: <true to sendTransaction, false to call (default)>
     * }
     */
    augur.run = augur.execute = augur.invoke = function (itx, f) {
        var tx, data_abi, packaged, invocation, invoked;
        if (itx) {
            tx = copy(itx);
            if (tx.params) {
                if (tx.params.constructor === Array) {
                    for (var i = 0, len = tx.params.length; i < len; ++i) {
                        if (tx.params[i] && tx.params[i].constructor === BigNumber) {
                            tx.params[i] = tx.params[i].toFixed();
                        }
                    }
                } else if (tx.params.constructor === Object) {
                    for (var p in tx.params) {
                        if (!tx.params.hasOwnProperty(p)) continue;
                        if (tx.params[p].constructor === BigNumber) {
                            tx.params[p] = tx.params[p].toFixed();
                        }
                    }
                } else if (tx.params.constructor === BigNumber) {
                    tx.params = tx.params.toFixed();
                }
            }
            if (tx.to) tx.to = augur.prefix_hex(tx.to);
            if (tx.from) tx.from = augur.prefix_hex(tx.from);
            data_abi = this.encode_abi(tx);
            if (data_abi) {
                packaged = {
                    from: tx.from || augur.coinbase,
                    to: tx.to,
                    data: data_abi,
                    returns: tx.returns
                };
                invocation = (tx.send) ? this.sendTx : this.call;
                invoked = true;
                return invocation(packaged, f);
            }
        }
        if (!invoked) {
            return "Error invoking " + tx.method + "@" + tx.to + "\n"+
                "Expected transaction format:" + JSON.stringify({
                    from: "<sender's address> (hexstring; optional, coinbase default)",
                    to: "<contract address> (hexstring)",
                    method: "<function name> (string)",
                    signature: '<function signature, e.g. "iia"> (string)',
                    params: "<parameters passed to the function> (optional)",
                    returns: '<"number[]", "int", "BigNumber", or "string" (default)>',
                    send: '<true to sendTransaction, false to call (default)>'
                });
        }
    };

    // Read the code in a contract on the blockchain
    augur.getCode = augur.read = function (address, block, f) {
        if (address) {
            return json_rpc(postdata("getCode", [address, block || "latest"]), f);
        }
    };

    // Batched RPC commands
    augur.batch = function (txlist, f) {
        var num_commands, rpclist, tx, data_abi, packaged, invocation;
        if (txlist.constructor === Array) {
            num_commands = txlist.length;
            rpclist = new Array(num_commands);
            for (var i = 0; i < num_commands; ++i) {
                tx = copy(txlist[i]);
                if (tx.params) {
                    if (tx.params.constructor === Array) {
                        for (var j = 0, len = tx.params.length; j < len; ++j) {
                            if (tx.params[j].constructor === BigNumber) {
                                tx.params[j] = tx.params[j].toFixed();
                            }
                        }
                    } else if (tx.params.constructor === BigNumber) {
                        tx.params = tx.params.toFixed();
                    }
                }
                if (tx.from) tx.from = this.prefix_hex(tx.from);
                tx.to = this.prefix_hex(tx.to);
                data_abi = this.encode_abi(tx);
                if (data_abi) {
                    packaged = {
                        from: tx.from || augur.coinbase,
                        to: tx.to,
                        data: data_abi,
                        returns: tx.returns
                    };
                    invocation = (tx.send) ? "sendTransaction" : "call";
                    rpclist[i] = postdata(invocation, packaged);
                } else {
                    log("unable to package commands for batch RPC");
                    return rpclist;
                }
            }
            return json_rpc(rpclist, f);
        } else {
            log("expected array for batch RPC, invoking instead");
            return this.invoke(txlist, f);
        }
    };

    // Error handling and propagation
    function error_codes(tx, response) {
        if (response && response.constructor === Array) {
            for (var i = 0, len = response.length; i < len; ++i) {
                response[i] = error_codes(tx.method, response[i]);
            }
        } else {
            if (augur.ERRORS[response]) {
                response = {
                    error: response,
                    message: augur.ERRORS[response]
                };
            } else {
                if (tx.returns !== "string" || (response.constructor === String && response.slice(0,2) === "0x")) {
                    var response_number = augur.bignum(response);
                    if (response_number) {
                        response_number = augur.bignum(response).toFixed();
                        if (augur.ERRORS[tx.method] && augur.ERRORS[tx.method][response_number]) {
                            response = {
                                error: response_number,
                                message: augur.ERRORS[tx.method][response_number]
                            };
                        }
                    }
                }
            }
        }
        return response;
    }
    function strategy(target, callback) {
        if (callback) {
            callback(target);
        } else {
            return target;
        }
    }
    function fire(itx, onSent) {
        var num_params_expected, num_params_received, tx;
        if (itx.signature && itx.signature.length) {
            if (itx.params) {
                if (itx.params.constructor === Array) {
                    num_params_received = itx.params.length;
                } else if (itx.params.constructor === Object) {
                    return strategy({
                        error: "-9000",
                        message: "cannot send object parameter to contract"
                    }, onSent);
                } else if (itx.params) {
                    num_params_received = 1;
                } 
            } else {
                num_params_received = 0;
            }
            num_params_expected = itx.signature.length;
            if (num_params_received !== num_params_expected) {
                return strategy({
                    error: "-1010101",
                    message: "expected " + num_params_expected.toString()+
                        " parameters, got " + num_params_received.toString()
                }, onSent);
            }
        }
        tx = copy(itx);
        if (onSent) {
            augur.invoke(tx, function (res) {
                onSent(error_codes(tx, res));
            });
        } else {
            return error_codes(tx, augur.invoke(tx, onSent));
        }        
    }

    /***************************************
     * Call-send-confirm callback sequence *
     ***************************************/

    function check_blockhash(tx, numeric, txhash, count, callback) {
        if (tx && tx.blockHash && augur.bignum(tx.blockHash).toNumber() !== 0) {
            tx.callReturn = numeric;
            tx.txHash = tx.hash;
            delete tx.hash;
            if (callback) callback(tx);
            else return tx;
        } else {
            if (count !== undefined && count < augur.TX_POLL_MAX) {
                setTimeout(function () {
                    tx_notify(count + 1, numeric, txhash, callback);
                }, augur.TX_POLL_INTERVAL);
            }
        }
    }
    function tx_notify(count, numeric, txhash, callback) {
        if (callback) {
            augur.getTx(txhash, function (tx) {
                check_blockhash(tx, numeric, txhash, count, callback);
            });
        } else {
            check_blockhash(augur.getTx(txhash), numeric, txhash, count);
        }
    }
    function send_confirm(tx, callreturn, onSent, onSuccess, onFailed) {
        var numeric, txhash, err;
        if (tx && callreturn) {
            if (augur.ERRORS[callreturn]) {
                err = {
                    error: callreturn,
                    message: augur.ERRORS[callreturn]
                };
                if (onFailed) {
                    onFailed(err);
                } else {
                    return err;
                }
            } else {
                tx.send = true;
                delete tx.returns;
                numeric = augur.bignum(callreturn);
                if (numeric) numeric = numeric.toFixed();
                if (numeric && augur.ERRORS[tx.method] && augur.ERRORS[tx.method][numeric]) {
                    err = {
                        error: numeric,
                        message: augur.ERRORS[tx.method][numeric]
                    };
                    if (onFailed) {
                        onFailed(err);
                    } else {
                        return err;
                    }
                } else {
                    if (onSent) {
                        augur.invoke(tx, function (txhash) {
                            if (txhash) {
                                onSent(txhash);
                                if (onSuccess) tx_notify(0, numeric, txhash, onSuccess);
                            }
                        });
                    } else {
                        txhash = augur.invoke(tx);
                        if (txhash) {
                            if (onSuccess) tx_notify(0, numeric, txhash, onSuccess);
                            return txhash;
                        }
                    }
                }
            }
        }
    }
    function call_send_confirm(tx, onSent, onSuccess, onFailed) {
        tx.send = false;
        if (onSent) {
            augur.invoke(tx, function (callreturn) {
                send_confirm(tx, callreturn, onSent, onSuccess, onFailed);
            });
        } else {
            return send_confirm(tx, augur.invoke(tx), null, onSuccess, onFailed);
        }
    }

    /***********************
     * Augur API functions *
     ***********************/

    // Augur transaction objects
    augur.init_contracts = copy(augur.contracts);
    augur.tx = {};

    // cash.se
    augur.tx.getCashBalance = {
        from: augur.coinbase,
        to: augur.contracts.cash,
        method: "balance",
        signature: "i",
        params: augur.coinbase,
        returns: "unfix"
    };
    augur.tx.sendCash = {
        from: augur.coinbase,
        to: augur.contracts.cash,
        method: "send",
        send: true,
        signature: "ii"
    };
    augur.tx.cashFaucet = {
        from: augur.coinbase,
        to: augur.contracts.cash,
        method: "faucet",
        send: true
    };
    augur.getCashBalance = function (account, onSent) {
        // account: ethereum address (hexstring)
        var tx = copy(augur.tx.getCashBalance);
        if (account) tx.params = account;
        return fire(tx, onSent);
    };
    augur.sendCash = function (to, value, onSent, onSuccess, onFailed) {
        // to: sha256
        // value: number -> fixed-point
        if (to && to.value) {
            value = to.value;
            if (to.onSent) onSent = to.onSent;
            if (to.onSuccess) onSuccess = to.onSuccess;
            if (to.onFailed) onFailed = to.onFailed;
            to = to.to;
        }
        var tx = copy(augur.tx.sendCash);
        tx.params = [to, augur.fix(value)];
        return call_send_confirm(tx, onSent, onSuccess, onFailed);
    };
    augur.cashFaucet = function (onSent) {
        return fire(augur.tx.cashFaucet, onSent);
    };

    // info.se
    augur.tx.getCreator = {
        to: augur.contracts.info,
        method: "getCreator",
        signature: "i"
    };
    augur.tx.getCreationFee = {
        to: augur.contracts.info,
        method: "getCreationFee",
        signature: "i",
        returns: "unfix"
    };
    augur.tx.getDescription = {
        to: augur.contracts.info,
        method: "getDescription",
        signature: "i",
        returns: "string"
    };
    augur.getCreator = function (id, onSent) {
        // id: sha256 hash id
        var tx = copy(augur.tx.getCreator);
        tx.params = id;
        return fire(tx, onSent);
    };
    augur.getCreationFee = function (id, onSent) {
        // id: sha256 hash id
        var tx = copy(augur.tx.getCreationFee);
        tx.params = id;
        return fire(tx, onSent);
    };
    augur.getDescription = function (item, onSent) {
        // item: sha256 hash id
        var tx = copy(augur.tx.getDescription);
        tx.params = item;
        return fire(tx, onSent);
    };

    // branches.se
    augur.tx.getBranches = {
        to: augur.contracts.branches,
        method: "getBranches",
        returns: "hash[]"
    };
    augur.tx.getMarkets = {
        to: augur.contracts.branches,
        method: "getMarkets",
        signature: "i",
        returns: "hash[]"
    };
    augur.tx.getPeriodLength = {
        to: augur.contracts.branches,
        method: "getPeriodLength",
        signature: "i",
        returns: "number"
    };
    augur.tx.getVotePeriod = {
        to: augur.contracts.branches,
        method: "getVotePeriod",
        signature: "i",
        returns: "number"
    };
    augur.tx.getStep = {
        to: augur.contracts.branches,
        method: "getStep",
        signature: "i",
        returns: "number"
    };
    augur.tx.getSubstep = {
        to: augur.contracts.branches,
        method: "getSubstep",
        signature: "i",
        returns: "number"
    };
    augur.tx.setSubstep = {
        to: augur.contracts.branches,
        method: "setSubstep",
        signature: "ii",
        send: true
    };
    augur.tx.incrementSubstep = {
        to: augur.contracts.branches,
        method: "incrementSubstep",
        signature: "i",
        send: true
    };
    augur.tx.getNumMarkets = {
        to: augur.contracts.branches,
        method: "getNumMarkets",
        signature: "i",
        returns: "number"
    };
    augur.tx.getMinTradingFee = {
        to: augur.contracts.branches,
        method: "getMinTradingFee",
        signature: "i",
        returns: "unfix"
    };
    augur.tx.getNumBranches = {
        to: augur.contracts.branches,
        method: "getNumBranches",
        returns: "number"
    };
    augur.tx.getBranch = {
        to: augur.contracts.branches,
        method: "getBranch",
        signature: "i"
    };
    augur.getBranches = function (onSent) {
        return fire(augur.tx.getBranches, onSent);
    };
    augur.getMarkets = function (branch, onSent) {
        // branch: sha256 hash id
        var tx = copy(augur.tx.getMarkets);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getPeriodLength = function (branch, onSent) {
        // branch: sha256 hash id
        var tx = copy(augur.tx.getPeriodLength);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getVotePeriod = function (branch, onSent) {
        // branch: sha256 hash id
        var tx = copy(augur.tx.getVotePeriod);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getStep = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.getStep);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getSubstep = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.getSubstep);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.setSubstep = function (branch, substep, onSent) {
        var tx = copy(augur.tx.setSubstep);
        tx.params = [branch, substep];
        return fire(tx, onSent);
    };
    augur.incrementSubstep = function (branch, onSent) {
        var tx = copy(augur.tx.incrementSubstep);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getNumMarkets = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.getNumMarkets);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getMinTradingFee = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.getMinTradingFee);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.getNumBranches = function (onSent) {
        return fire(augur.tx.getNumBranches, onSent);
    };
    augur.getBranch = function (branchNumber, onSent) {
        // branchNumber: integer
        var tx = copy(augur.tx.getBranch);
        tx.params = branchNumber;
        return fire(tx, onSent);
    };

    // events.se
    augur.tx.getEventInfo = {
        to: augur.contracts.events,
        method: "getEventInfo",
        signature: "i",
        returns: "mixed[]"
    };
    augur.getEventInfo = function (event, onSent) {
        // event: sha256 hash id
        augur.tx.getEventInfo.params = event;
        if (onSent) {
            augur.invoke(augur.tx.getEventInfo, function (eventInfo) {
                if (eventInfo && eventInfo.length) {
                    var info = {
                        branch: eventInfo[0],
                        expirationDate: augur.bignum(eventInfo[1]).toFixed(),
                        outcome: augur.bignum(eventInfo[2]).toFixed(),
                        minValue: augur.bignum(eventInfo[3]).toFixed(),
                        maxValue: augur.bignum(eventInfo[4]).toFixed(),
                        numOutcomes: augur.bignum(eventInfo[5]).toFixed()
                    };
                    augur.getDescription(event, function (description) {
                        if (description) info.description = description;
                        if (onSent) onSent(info);
                    });
                }
            });
        } else {
            var eventInfo = augur.invoke(augur.tx.getEventInfo);
            if (eventInfo && eventInfo.length) {
                var info = {
                    branch: eventInfo[0],
                    expirationDate: augur.bignum(eventInfo[1]).toFixed(),
                    outcome: augur.bignum(eventInfo[2]).toFixed(),
                    minValue: augur.bignum(eventInfo[3]).toFixed(),
                    maxValue: augur.bignum(eventInfo[4]).toFixed(),
                    numOutcomes: augur.bignum(eventInfo[5]).toFixed()
                };
                var description = augur.getDescription(event);
                if (description) info.description = description;
                return info;
            }
        }
    };

    augur.tx.getEventBranch = {
        to: augur.contracts.events,
        method: "getEventBranch",
        signature: "i"
    };
    augur.tx.getExpiration = {
        to: augur.contracts.events,
        method: "getExpiration",
        signature: "i",
        returns: "number"
    };
    augur.tx.getOutcome = {
        to: augur.contracts.events,
        method: "getOutcome",
        signature: "i",
        returns: "number"
    };
    augur.tx.getMinValue = {
        to: augur.contracts.events,
        method: "getMinValue",
        signature: "i",
        returns: "number"
    };
    augur.tx.getMaxValue = {
        to: augur.contracts.events,
        method: "getMaxValue",
        signature: "i",
        returns: "number"
    };
    augur.tx.getNumOutcomes = {
        to: augur.contracts.events,
        method: "getNumOutcomes",
        signature: "i",
        returns: "number"
    };
    augur.getEventBranch = function (branchNumber, onSent) {
        // branchNumber: integer
        var tx = copy(augur.tx.getEventBranch);
        tx.params = branchNumber;
        return fire(tx, onSent);
    };
    augur.getExpiration = function (event, onSent) {
        // event: sha256
        var tx = copy(augur.tx.getExpiration);
        tx.params = event;
        return fire(tx, onSent);
    };
    augur.getOutcome = function (event, onSent) {
        // event: sha256
        var tx = copy(augur.tx.getOutcome);
        tx.params = event;
        return fire(tx, onSent);
    };
    augur.getMinValue = function (event, onSent) {
        // event: sha256
        var tx = copy(augur.tx.getMinValue);
        tx.params = event;
        return fire(tx, onSent);
    };
    augur.getMaxValue = function (event, onSent) {
        // event: sha256
        var tx = copy(augur.tx.getMaxValue);
        tx.params = event;
        return fire(tx, onSent);
    };
    augur.getNumOutcomes = function (event, onSent) {
        // event: sha256
        var tx = copy(augur.tx.getNumOutcomes);
        tx.params = event;
        return fire(tx, onSent);
    };
    augur.getCurrentVotePeriod = function (branch, onSent) {
        // branch: sha256
        var periodLength, blockNum;
        augur.tx.getPeriodLength.params = branch;
        if (onSent) {
            augur.invoke(augur.tx.getPeriodLength, function (periodLength) {
                if (periodLength) {
                    periodLength = augur.bignum(periodLength);
                    augur.blockNumber(function (blockNum) {
                        blockNum = augur.bignum(blockNum);
                        onSent(blockNum.dividedBy(periodLength).floor().sub(1));
                    });
                }
            });
        } else {
            periodLength = augur.invoke(augur.tx.getPeriodLength);
            if (periodLength) {
                blockNum = augur.bignum(augur.blockNumber());
                return blockNum.dividedBy(augur.bignum(periodLength)).floor().sub(1);
            }
        }
    };

    // expiringEvents.se
    augur.tx.getEvents = {
        to: augur.contracts.expiringEvents,
        method: "getEvents",
        signature: "ii",
        returns: "hash[]"
    };
    augur.tx.getNumberEvents = {
        to: augur.contracts.expiringEvents,
        method: "getNumberEvents",
        signature: "ii",
        returns: "number"
    };
    augur.tx.getEvent = {
        to: augur.contracts.expiringEvents,
        method: "getEvent",
        signature: "iii"
    };
    augur.tx.getTotalRepReported = {
        to: augur.contracts.expiringEvents,
        method: "getTotalRepReported",
        signature: "ii",
        returns: "unfix"
    };
    augur.tx.getReporterBallot = {
        to: augur.contracts.expiringEvents,
        method: "getReporterBallot",
        signature: "iii",
        returns: "number[]"
    };
    augur.tx.getReport = {
        to: augur.contracts.expiringEvents,
        method: "getReport",
        signature: "iiii",
        returns: "unfix"
    };
    augur.tx.getReportHash = {
        to: augur.contracts.expiringEvents,
        method: "getReportHash",
        signature: "iii"
    };
    augur.tx.getVSize = {
        to: augur.contracts.expiringEvents,
        method: "getVSize",
        signature: "ii",
        returns: "number"
    };
    augur.tx.getReportsFilled = {
        to: augur.contracts.expiringEvents,
        method: "getReportsFilled",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getReportsMask = {
        to: augur.contracts.expiringEvents,
        method: "getReportsMask",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getWeightedCenteredData = {
        to: augur.contracts.expiringEvents,
        method: "getWeightedCenteredData",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getCovarianceMatrixRow = {
        to: augur.contracts.expiringEvents,
        method: "getCovarianceMatrixRow",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getDeflated = {
        to: augur.contracts.expiringEvents,
        method: "getDeflated",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getLoadingVector = {
        to: augur.contracts.expiringEvents,
        method: "getLoadingVector",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getLatent = {
        to: augur.contracts.expiringEvents,
        method: "getLatent",
        signature: "ii",
        returns: "unfix"
    };
    augur.tx.getScores = {
        to: augur.contracts.expiringEvents,
        method: "getScores",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getSetOne = {
        to: augur.contracts.expiringEvents,
        method: "getSetOne",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getSetTwo = {
        to: augur.contracts.expiringEvents,
        method: "getSetTwo",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.returnOld = {
        to: augur.contracts.expiringEvents,
        method: "returnOld",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getNewOne = {
        to: augur.contracts.expiringEvents,
        method: "getNewOne",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getNewTwo = {
        to: augur.contracts.expiringEvents,
        method: "getNewTwo",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getAdjPrinComp = {
        to: augur.contracts.expiringEvents,
        method: "getAdjPrinComp",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getSmoothRep = {
        to: augur.contracts.expiringEvents,
        method: "getSmoothRep",
        signature: "ii",
        returns: "number[]"
    };
    augur.tx.getOutcomesFinal = {
        to: augur.contracts.expiringEvents,
        method: "getOutcomesFinal",
        signature: "ii",
        returns: "number[]"
    };
    augur.getEvents = function (branch, votePeriod, onSent) {
        // branch: sha256 hash id
        // votePeriod: integer
        var tx = copy(augur.tx.getEvents);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getEventsRange = function (branch, vpStart, vpEnd, onSent) {
        // branch: sha256
        // vpStart: integer
        // vpEnd: integer
        var vp_range, txlist;
        vp_range = vpEnd - vpStart + 1; // inclusive
        txlist = new Array(vp_range);
        for (var i = 0; i < vp_range; ++i) {
            txlist[i] = {
                from: augur.coinbase,
                to: augur.contracts.expiringEvents,
                method: "getEvents",
                signature: "ii",
                returns: "hash[]",
                params: [branch, i + vpStart]
            };
        }
        return augur.batch(txlist, onSent);
    };
    augur.getNumberEvents = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getNumberEvents);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getEvent = function (branch, votePeriod, eventIndex, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getEvent);
        tx.params = [branch, votePeriod, eventIndex];
        return fire(tx, onSent);
    };
    augur.getTotalRepReported = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getTotalRepReported);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getReporterBallot = function (branch, votePeriod, reporterID, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getReporterBallot);
        tx.params = [branch, votePeriod, reporterID];
        return fire(tx, onSent);
    };
    augur.getReport = function (branch, votePeriod, reporter, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getReports);
        tx.params = [branch, votePeriod, reporter];
        return fire(tx, onSent);
    };
    augur.getReportHash = function (branch, votePeriod, reporter, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getReportHash);
        tx.params = [branch, votePeriod, reporter];
        return fire(tx, onSent);
    };
    augur.getVSize = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getVSize);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getReportsFilled = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getReportsFilled);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getReportsMask = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getReportsMask);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getWeightedCenteredData = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getWeightedCenteredData);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getCovarianceMatrixRow = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getCovarianceMatrixRow);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getDeflated = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getDeflated);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getLoadingVector = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getLoadingVector);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getLatent = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getLatent);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getScores = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getScores);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getSetOne = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getSetOne);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getSetTwo = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getSetTwo);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.returnOld = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.returnOld);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getNewOne = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getNewOne);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getNewTwo = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getNewTwo);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getAdjPrinComp = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getAdjPrinComp);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getSmoothRep = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getSmoothRep);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };
    augur.getOutcomesFinal = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.getOutcomesFinal);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };

    augur.tx.makeBallot = {
        to: augur.contracts.expiringEvents,
        method: "makeBallot",
        signature: "ii",
        returns: "hash[]"
    };
    augur.makeBallot = function (branch, votePeriod, onSent) {
        // branch: sha256
        // votePeriod: integer
        var tx = copy(augur.tx.makeBallot);
        tx.params = [branch, votePeriod];
        return fire(tx, onSent);
    };

    // markets.se
    augur.tx.getSimulatedBuy = {
       
        to: augur.contracts.markets,
        method: "getSimulatedBuy",
        signature: "iii",
        returns: "number[]"
    };
    augur.tx.getSimulatedSell = {
       
        to: augur.contracts.markets,
        method: "getSimulatedSell",
        signature: "iii",
        returns: "number[]"
    };
    augur.getSimulatedBuy = function (market, outcome, amount, onSent) {
        // market: sha256 hash id
        // outcome: integer (1 or 2 for binary events)
        // amount: number -> fixed-point
        var tx = copy(augur.tx.getSimulatedBuy);
        tx.params = [market, outcome, augur.fix(amount)];
        return fire(tx, onSent);
    };
    augur.getSimulatedSell = function (market, outcome, amount, onSent) {
        // market: sha256 hash id
        // outcome: integer (1 or 2 for binary events)
        // amount: number -> fixed-point
        var tx = copy(augur.tx.getSimulatedSell);
        tx.params = [market, outcome, augur.fix(amount)];
        return fire(tx, onSent);
    };

    augur.tx.lsLmsr = {
       
        to: augur.contracts.markets,
        method: "lsLmsr",
        signature: "i",
        returns: "unfix"
    };
    augur.lsLmsr = function (market, onSent) {
        // market: sha256
        var tx = copy(augur.tx.lsLmsr);
        tx.params = market;
        return fire(tx, onSent);
    };

    augur.filters = {}; // key: marketId => {filterId: hexstring, polling: bool}

    augur.tx.getMarketInfo = {
       
        to: augur.contracts.markets,
        method: "getMarketInfo",
        signature: "i",
        returns: "mixed[]"
    };
    augur.getMarketInfo = function (market, onSent) {
        // market: sha256 hash id
        augur.tx.getMarketInfo.params = market;
        if (onSent) {
            augur.invoke(augur.tx.getMarketInfo, function (marketInfo) {
                if (marketInfo && marketInfo.length) {
                    var info = {
                        currentParticipant: augur.bignum(marketInfo[0]).toFixed(),
                        alpha: augur.unfix(marketInfo[1], "string"),
                        cumulativeScale: augur.bignum(marketInfo[2]).toFixed(),
                        numOutcomes: augur.bignum(marketInfo[3]).toFixed(),
                        tradingPeriod: augur.bignum(marketInfo[4]).toFixed(),
                        tradingFee: augur.unfix(marketInfo[5], "string")
                    };
                    augur.getDescription(market, function (description) {
                        if (description) {
                            info.description = description;
                        }
                        info.filter = augur.initComments(market);
                        onSent(info);
                    });
                }
            });
        } else {
            var marketInfo = augur.invoke(augur.tx.getMarketInfo);
            if (marketInfo && marketInfo.length) {
                var info = {
                    currentParticipant: augur.bignum(marketInfo[0]).toFixed(),
                    alpha: augur.unfix(marketInfo[1], "string"),
                    cumulativeScale: augur.bignum(marketInfo[2]).toFixed(),
                    numOutcomes: augur.bignum(marketInfo[3]).toFixed(),
                    tradingPeriod: augur.bignum(marketInfo[4]).toFixed(),
                    tradingFee: augur.unfix(marketInfo[5], "string")
                };
                var description = augur.getDescription(market);
                if (description) {
                    info.description = description;
                }
                info.filter = augur.initComments(market);
                return info;
            }
        }
    };

    augur.tx.getMarketEvents = {
       
        to: augur.contracts.markets,
        method: "getMarketEvents",
        signature: "i",
        returns: "hash[]"
    };
    augur.tx.getNumEvents = {
       
        to: augur.contracts.markets,
        method: "getNumEvents",
        signature: "i",
        returns: "number"
    };
    augur.getMarketEvents = function (market, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getMarketEvents);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.getNumEvents = function (market, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getNumEvents);
        tx.params = market;
        return fire(tx, onSent);
    };

    augur.tx.getBranchID = {
       
        to: augur.contracts.markets,
        method: "getBranchID",
        signature: "i"
    };
    augur.tx.getCurrentParticipantNumber = {
       
        to: augur.contracts.markets,
        method: "getCurrentParticipantNumber",
        signature: "i",
        returns: "number"
    };
    augur.tx.getMarketNumOutcomes = {
       
        to: augur.contracts.markets,
        method: "getMarketNumOutcomes",
        signature: "i",
        returns: "number"
    };
    augur.tx.getParticipantSharesPurchased = {
       
        to: augur.contracts.markets,
        method: "getParticipantSharesPurchased",
        signature: "iii",
        returns: "unfix"
    };
    augur.tx.getSharesPurchased = {
       
        to: augur.contracts.markets,
        method: "getSharesPurchased",
        signature: "ii",
        returns: "unfix"
    };
    augur.tx.getWinningOutcomes = {
       
        to: augur.contracts.markets,
        method: "getWinningOutcomes",
        signature: "i",
        returns: "hash[]"
    };
    augur.tx.price = {
       
        to: augur.contracts.markets,
        method: "price",
        signature: "ii",
        returns: "unfix"
    };
    augur.getBranchID = function (branch, onSent) {
        // branch: sha256 hash id
        var tx = copy(augur.tx.getBranchID);
        tx.params = branch;
        return fire(tx, onSent);
    };
    // Get the current number of participants in this market
    augur.getCurrentParticipantNumber = function (market, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getCurrentParticipantNumber);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.getMarketNumOutcomes = function (market, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getMarketNumOutcomes);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.getParticipantSharesPurchased = function (market, participationNumber, outcome, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getParticipantSharesPurchased);
        tx.params = [market, participationNumber, outcome];
        return fire(tx, onSent);
    };
    augur.getSharesPurchased = function (market, outcome, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getSharesPurchased);
        tx.params = [market, outcome];
        return fire(tx, onSent);
    };
    augur.getWinningOutcomes = function (market, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.getWinningOutcomes);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.price = function (market, outcome, onSent) {
        // market: sha256 hash id
        var tx = copy(augur.tx.price);
        tx.params = [market, outcome];
        return fire(tx, onSent);
    };

    augur.tx.getParticipantNumber = {
       
        to: augur.contracts.markets,
        method: "getParticipantNumber",
        signature: "ii",
        returns: "number"
    };
    augur.tx.getParticipantID = {
       
        to: augur.contracts.markets,
        method: "getParticipantID",
        signature: "ii"
    };
    // Get the participant number (the array index) for specified address
    augur.getParticipantNumber = function (market, address, onSent) {
        // market: sha256
        // address: ethereum account
        var tx = copy(augur.tx.getParticipantNumber);
        tx.params = [market, address];
        return fire(tx, onSent);
    };
    // Get the address for the specified participant number (array index) 
    augur.getParticipantID = function (market, participantNumber, onSent) {
        // market: sha256
        var tx = copy(augur.tx.getParticipantID);
        tx.params = [market, participantNumber];
        return fire(tx, onSent);
    };

    augur.tx.getAlpha = {
       
        to: augur.contracts.markets,
        method: "getAlpha",
        signature: "i",
        returns: "unfix"
    };
    augur.tx.getCumScale = {
       
        to: augur.contracts.markets,
        method: "getCumScale",
        signature: "i",
        returns: "unfix"
    };
    augur.tx.getTradingPeriod = {
       
        to: augur.contracts.markets,
        method: "getTradingPeriod",
        signature: "i",
        returns: "number"
    };
    augur.tx.getTradingFee = {
       
        to: augur.contracts.markets,
        method: "getTradingFee",
        signature: "i",
        returns: "unfix"
    };
    augur.getAlpha = function (market, onSent) {
        // market: sha256
        var tx = copy(augur.tx.getAlpha);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.getCumScale = function (market, onSent) {
        // market: sha256
        var tx = copy(augur.tx.getCumScale);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.getTradingPeriod = function (market, onSent) {
        // market: sha256
        var tx = copy(augur.tx.getTradingPeriod);
        tx.params = market;
        return fire(tx, onSent);
    };
    augur.getTradingFee = function (market, onSent) {
        // market: sha256
        var tx = copy(augur.tx.getTradingFee);
        tx.params = market;
        return fire(tx, onSent);
    };

    // reporting.se
    augur.tx.getRepBalance = {
       
        to: augur.contracts.reporting,
        method: "getRepBalance",
        signature: "ii",
        returns: "unfix"
    };
    augur.tx.getRepByIndex = {
       
        to: augur.contracts.reporting,
        method: "getRepByIndex",
        signature: "ii",
        returns: "unfix"
    };
    augur.tx.getReporterID = {
       
        to: augur.contracts.reporting,
        method: "getReporterID",
        signature: "ii"
    };
    augur.tx.getReputation = {
       
        to: augur.contracts.reporting,
        method: "getReputation",
        signature: "i",
        returns: "number[]"
    };
    augur.tx.getNumberReporters = {
       
        to: augur.contracts.reporting,
        method: "getNumberReporters",
        signature: "i",
        returns: "number"
    };
    augur.tx.repIDToIndex = {
       
        to: augur.contracts.reporting,
        method: "repIDToIndex",
        signature: "ii",
        returns: "number"
    };
    augur.getRepBalance = function (branch, account, onSent) {
        // branch: sha256 hash id
        // account: ethereum address (hexstring)
        var tx = copy(augur.tx.getRepBalance);
        tx.params = [branch, account];
        return fire(tx, onSent);
    };
    augur.getRepByIndex = function (branch, repIndex, onSent) {
        // branch: sha256
        // repIndex: integer
        var tx = copy(augur.tx.getRepByIndex);
        tx.params = [branch, repIndex];
        return fire(tx, onSent);
    };
    augur.getReporterID = function (branch, index, onSent) {
        // branch: sha256
        // index: integer
        var tx = copy(augur.tx.getReporterID);
        tx.params = [branch, index];
        return fire(tx, onSent);
    };
    // reputation of a single address over all branches
    augur.getReputation = function (address, onSent) {
        // address: ethereum account
        var tx = copy(augur.tx.getReputation);
        tx.params = address;
        return fire(tx, onSent);
    };
    augur.getNumberReporters = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.getNumberReporters);
        tx.params = branch;
        return fire(tx, onSent);
    };
    augur.repIDToIndex = function (branch, repID, onSent) {
        // branch: sha256
        // repID: ethereum account
        var tx = copy(augur.tx.repIDToIndex);
        tx.params = [branch, repID];
        return fire(tx, onSent);
    };

    augur.tx.hashReport = {
       
        to: augur.contracts.reporting,
        method: "hashReport",
        signature: "ai"
    };
    augur.tx.reputationFaucet = {
       
        to: augur.contracts.reporting,
        method: "faucet",
        signature: "i",
        send: true
    };
    augur.hashReport = function (ballot, salt, onSent) {
        // ballot: number[]
        // salt: integer
        if (ballot.constructor === Array) {
            var tx = copy(augur.tx.hashReport);
            tx.params = [ballot, salt];
            return fire(tx, onSent);
        }
    };
    augur.reputationFaucet = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.reputationFaucet);
        tx.params = branch;
        return fire(tx, onSent);
    };

    // checkQuorum.se
    augur.tx.checkQuorum = {
       
        to: augur.contracts.checkQuorum,
        method: "checkQuorum",
        signature: "i",
        returns: "number"
    };
    augur.checkQuorum = function (branch, onSent) {
        // branch: sha256
        var tx = copy(augur.tx.checkQuorum);
        tx.params = branch;
        return fire(tx, onSent);
    };

    // buy&sellShares.se
    augur.tx.getNonce = {
       
        to: augur.contracts.buyAndSellShares,
        method: "getNonce",
        signature: "i",
        returns: "number"
    };
    augur.tx.buyShares = {
       
        to: augur.contracts.buyAndSellShares,
        method: "buyShares",
        signature: "iiiii",
        send: true
    };
    augur.tx.sellShares = {
       
        to: augur.contracts.buyAndSellShares,
        method: "sellShares",
        signature: "iiiii",
        send: true
    };
    augur.getNonce = function (id, onSent) {
        // id: sha256 hash id
        var tx = copy(augur.tx.getNonce);
        tx.params = id;
        return fire(tx, onSent);
    };
    augur.buyShares = function (branch, market, outcome, amount, nonce, onSent, onSuccess, onFailed) {
        if (branch && branch.constructor === Object && branch.branchId) {
            market = branch.marketId; // sha256
            outcome = branch.outcome; // integer (1 or 2 for binary)
            amount = branch.amount;   // number -> fixed-point
            if (branch.nonce) {
                nonce = branch.nonce; // integer (optional)
            }
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId; // sha256
        }
        var tx = copy(augur.tx.buyShares);
        if (onSent) {
            augur.getNonce(market, function (nonce) {
                tx.params = [branch, market, outcome, augur.fix(amount), nonce];
                call_send_confirm(tx, onSent, onSuccess, onFailed);
            });
        } else {
            nonce = augur.getNonce(market);
            tx.params = [branch, market, outcome, augur.fix(amount), nonce];
            return call_send_confirm(tx);
        }
    };
    augur.sellShares = function (branch, market, outcome, amount, nonce, onSent, onSuccess, onFailed) {
        if (branch && branch.constructor === Object && branch.branchId) {
            market = branch.marketId; // sha256
            outcome = branch.outcome; // integer (1 or 2 for binary)
            amount = branch.amount;   // number -> fixed-point
            if (branch.nonce) {
                nonce = branch.nonce; // integer (optional)
            }
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId; // sha256
        }
        var tx = copy(augur.tx.sellShares);
        if (onSent) {
            augur.getNonce(market, function (nonce) {
                tx.params = [branch, market, outcome, augur.fix(amount), nonce];
                call_send_confirm(tx, onSent, onSuccess, onFailed);
            });
        } else {
            nonce = augur.getNonce(market);
            tx.params = [branch, market, outcome, augur.fix(amount), nonce];
            return call_send_confirm(tx);
        }
    };

    // createBranch.se

    // p2pWagers.se

    // sendReputation.se
    augur.tx.sendReputation = {
       
        to: augur.contracts.sendReputation,
        method: "sendReputation",
        signature: "iii",
        send: true
    };
    augur.sendReputation = function (branch, to, value, onSent, onSuccess, onFailed) {
        // branch: sha256
        // to: sha256
        // value: number -> fixed-point
        if (branch && branch.branchId && branch.to && branch.value) {
            to = branch.to;
            value = branch.value;
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId;
        }
        var tx = copy(augur.tx.sendReputation);
        tx.params = [branch, to, augur.fix(value)];
        return call_send_confirm(tx, onSent, onSuccess, onFailed);
    };

    // transferShares.se

    // makeReports.se
    augur.tx.report = {
        to: augur.contracts.makeReports,
        method: "report",
        signature: "iaii",
        returns: "number",
        send: true
    };
    augur.tx.submitReportHash = {
        to: augur.contracts.makeReports,
        method: "submitReportHash",
        signature: "iii",
        returns: "number",
        send: true
    };
    augur.tx.checkReportValidity = {
        to: augur.contracts.makeReports,
        method: "checkReportValidity",
        signature: "iai",
        returns: "number"
    };
    augur.tx.slashRep = {
        to: augur.contracts.makeReports,
        method: "slashRep",
        signature: "iiiai",
        returns: "number",
        send: true
    };
    augur.report = function (branch, report, votePeriod, salt, onSent, onSuccess, onFailed) {
        if (branch.constructor === Object && branch.branchId) {
            report = branch.report;
            votePeriod = branch.votePeriod;
            salt = branch.salt;
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId;
        }
        var tx = copy(augur.tx.report);
        tx.params = [branch, report, votePeriod, salt];
        return call_send_confirm(tx, onSent, onSuccess, onFailed);
    };
    augur.submitReportHash = function (branch, reportHash, votePeriod, onSent, onSuccess, onFailed) {
        if (branch.constructor === Object && branch.branchId) {
            reportHash = branch.reportHash;
            votePeriod = branch.votePeriod;
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId;
        }
        var tx = copy(augur.tx.submitReportHash);
        tx.params = [branch, reportHash, votePeriod];
        return call_send_confirm(tx, onSent, onSuccess, onFailed);
    };
    augur.checkReportValidity = function (branch, report, votePeriod, onSent, onSuccess, onFailed) {
        if (branch.constructor === Object && branch.branchId) {
            report = branch.report;
            votePeriod = branch.votePeriod;
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId;
        }
        var tx = copy(augur.tx.checkReportValidity);
        tx.params = [branch, report, votePeriod];
        return call_send_confirm(tx, onSent, onSuccess, onFailed);
    };
    augur.slashRep = function (branch, votePeriod, salt, report, reporter, onSent, onSuccess, onFailed) {
        if (branch.constructor === Object && branch.branchId) {
            votePeriod = branch.votePeriod;
            salt = branch.salt;
            report = branch.report;
            reporter = branch.reporter;
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId;
        }
        var tx = copy(augur.tx.slashRep);
        tx.params = [branch, votePeriod, salt, report, reporter];
        return call_send_confirm(tx, onSent, onSuccess, onFailed);
    };

    // createEvent.se
    augur.tx.createEvent = {
       
        to: augur.contracts.createEvent,
        method: "createEvent",
        signature: "isiiii",
        send: true
    };
    augur.createEvent = function (branch, description, expDate, minValue, maxValue, numOutcomes, onSent, onSuccess, onFailed) {
        // first parameter can optionally be a transaction object
        if (branch.constructor === Object && branch.branchId) {
            description = branch.description; // string
            minValue = branch.minValue;       // integer (1 for binary)
            maxValue = branch.maxValue;       // integer (2 for binary)
            numOutcomes = branch.numOutcomes; // integer (2 for binary)
            expDate = branch.expDate;         // integer
            if (branch.onSent) onSent = branch.onSent;           // function({id, txhash})
            if (branch.onSuccess) onSuccess = branch.onSuccess;     // function({id, txhash})
            if (branch.onFailed) onFailed = branch.onFailed;       // function({id, txhash})
            branch = branch.branchId;         // sha256 hash
        }
        augur.tx.createEvent.params = [
            branch,
            description,
            expDate,
            minValue,
            maxValue,
            numOutcomes
        ];
        augur.tx.createEvent.send = false;
        augur.invoke(augur.tx.createEvent, function (eventID) {
            var eventID_number, event;
            if (eventID && eventID !== "0x") {
                if (eventID.error) {
                    if (onFailed) onFailed(eventID);
                } else {
                    eventID_number = augur.bignum(eventID).toFixed();
                    if (augur.ERRORS.createEvent[eventID_number]) {
                        if (onFailed) onFailed({
                            error: eventID_number,
                            message: augur.ERRORS.createEvent[eventID_number]
                        });
                    } else {
                        event = { id: eventID };
                        augur.tx.createEvent.send = true;
                        augur.invoke(augur.tx.createEvent, function (txhash) {
                            var pings, pingTx;
                            if (txhash) {
                                event.txHash = txhash;
                                if (onSent) onSent(event);
                                if (onSuccess) {
                                    pings = 0;
                                    pingTx = function () {
                                        augur.getEventInfo(eventID, function (eventInfo) {
                                            pings++;
                                            if (eventInfo && eventInfo !== "0x" && eventInfo.expirationDate && eventInfo.expirationDate !== 0 && eventInfo.expirationDate !== "0") {
                                                event.branch = eventInfo.branch;
                                                event.expirationDate = eventInfo.expirationDate;
                                                event.outcome = eventInfo.outcome;
                                                event.minValue = eventInfo.minValue;
                                                event.maxValue = eventInfo.maxValue;
                                                event.numOutcomes = eventInfo.numOutcomes;
                                                event.description = eventInfo.description;
                                                onSuccess(event);
                                            } else {
                                                if (pings < augur.TX_POLL_MAX) setTimeout(pingTx, 12000);
                                            }
                                        });
                                    };
                                    pingTx();
                                }
                            }
                        });
                    }
                }
            }
        });
    };

    // createMarket.se
    augur.tx.createMarket = {
       
        to: augur.contracts.createMarket,
        method: "createMarket",
        signature: "isiiia",
        send: true
    };
    augur.createMarket = function (branch, description, alpha, liquidity, tradingFee, events, onSent, onSuccess, onFailed) {
        // first parameter can optionally be a transaction object
        if (branch.constructor === Object && branch.branchId) {
            alpha = branch.alpha;                // number -> fixed-point
            description = branch.description;    // string
            liquidity = branch.initialLiquidity; // number -> fixed-point
            tradingFee = branch.tradingFee;      // number -> fixed-point
            events = branch.events;              // array [sha256, ...]
            onSent = branch.onSent;              // function({id, txhash})
            onSuccess = branch.onSuccess;        // function({id, txhash})
            onFailed = branch.onFailed;          // function({id, txhash})
            branch = branch.branchId;            // sha256 hash
        }
        augur.tx.createMarket.params = [
            branch,
            description,
            augur.fix(alpha, "hex"),
            augur.fix(liquidity, "hex"),
            augur.fix(tradingFee, "hex"),
            events
        ];
        augur.tx.createMarket.send = false;
        augur.invoke(augur.tx.createMarket, function (marketID) {
            var marketID_number, market;
            if (marketID && marketID !== "0x") {
                if (marketID.error) {
                    if (onFailed) onFailed(marketID);
                } else {
                    marketID_number = augur.bignum(marketID);
                    if (marketID_number) {
                        marketID_number = marketID_number.toFixed();
                    }
                    if (marketID_number && augur.ERRORS.createMarket[marketID_number]) {
                        if (onFailed) onFailed({
                            error: marketID_number,
                            message: augur.ERRORS.createMarket[marketID_number]
                        });
                    } else {
                        market = { id: marketID };
                        augur.tx.createMarket.send = true;
                        augur.invoke(augur.tx.createMarket, function (txhash) {
                            var pings, pingTx;
                            if (txhash) {
                                market.txHash = txhash;
                                if (onSent) onSent(market);
                                if (onSuccess) {
                                    pings = 0;
                                    pingTx = function () {
                                        augur.getMarketInfo(marketID, function (marketInfo) {
                                            pings++;
                                            if (marketInfo && marketInfo !== "0x" && marketInfo.numOutcomes && marketInfo.numOutcomes !== 0 && marketInfo.numOutcomes !== "0") {
                                                market.numOutcomes = marketInfo.numOutcomes;
                                                market.currentParticipant = marketInfo.currentParticipant;
                                                market.alpha = marketInfo.alpha;
                                                market.cumulativeScale = marketInfo.cumulativeScale;
                                                market.numOutcomes = marketInfo.numOutcomes;
                                                market.tradingPeriod = marketInfo.tradingPeriod;
                                                market.tradingFee = marketInfo.tradingFee;
                                                market.description = marketInfo.description;
                                                onSuccess(market);
                                            } else {
                                                if (pings < augur.TX_POLL_MAX) setTimeout(pingTx, 12000);
                                            }
                                        });
                                    };
                                    pingTx();
                                }
                            }
                        });
                    }
                }
            }
        });
    };

    // closeMarket.se
    augur.tx.closeMarket = {
        to: augur.contracts.closeMarket,
        method: "closeMarket",
        signature: "ii",
        returns: "number",
        send: true
    };
    augur.closeMarket = function (branch, market, onSent) {
        // branch: sha256
        // market: sha256
        var tx = copy(augur.tx.closeMarket);
        tx.params = [branch, market];
        return fire(tx, onSent);
    };

    // dispatch.se
    augur.tx.dispatch = {
        to: augur.contracts.dispatch,
        method: "dispatch",
        signature: "i",
        send: true
    };
    augur.dispatch = function (branch, onSent, onSuccess, onFailed) {
        // branch: sha256 or transaction object
        var step, pings, txhash, pingTx;
        if (branch.constructor === Object && branch.branchId) {
            if (branch.onSent) onSent = branch.onSent;
            if (branch.onSuccess) onSuccess = branch.onSuccess;
            if (branch.onFailed) onFailed = branch.onFailed;
            branch = branch.branchId;
        }
        augur.tx.dispatch.params = branch;
        augur.tx.dispatch.send = false;
        augur.tx.dispatch.returns = "number";
        if (onSent) {
            augur.invoke(augur.tx.dispatch, function (step) {
                if (step) {
                    if (augur.ERRORS.dispatch[step]) {
                        step = {
                            error: step,
                            message: augur.ERRORS.dispatch[step]
                        };
                        if (onFailed) onFailed(step);
                    } else {
                        step = { step: step };
                    }
                    augur.tx.dispatch.send = true;
                    delete augur.tx.dispatch.returns;
                    augur.invoke(augur.tx.dispatch, function (txhash) {
                        if (txhash) {
                            step.txHash = txhash;
                            if (onSent) onSent(step);
                            if (onSuccess) {
                                pings = 0;
                                pingTx = function () {
                                    augur.getTx(txhash, function (tx) {
                                        pings++;
                                        if (tx && tx.blockHash && parseInt(tx.blockHash) !== 0) {
                                            tx.step = step.step;
                                            tx.txHash = tx.hash;
                                            delete tx.hash;
                                            onSuccess(tx);
                                        } else {
                                            if (pings < augur.TX_POLL_MAX) {
                                                setTimeout(pingTx, 12000);
                                            }
                                        }
                                    });
                                };
                                pingTx();
                            }
                        }
                    });
                }
            });
        } else {
            step = augur.invoke(augur.tx.dispatch);
            if (step) {
                step = { step: step };
                if (augur.ERRORS.dispatch[step]) {
                    if (onFailed) onFailed(step);
                } else {
                    augur.tx.dispatch.send = true;
                    delete augur.tx.dispatch.returns;
                    txhash = augur.invoke(augur.tx.dispatch);
                    if (txhash) {
                        step.txHash = txhash;
                        return step;
                    }
                }
            }
        }
    };

    /***************************
     * Whisper comments system *
     ***************************/

    augur.getMessages = function (filter, f) {
        return json_rpc(postdata("getMessages", filter, "shh_"), f);
    };
    augur.getFilterChanges = function (filter, f) {
        return json_rpc(postdata("getFilterChanges", filter, "shh_"), f);
    };
    augur.putString = function (key, string, f) {
        return json_rpc(postdata("putString", ["augur", key, string], "db_"), f);
    };
    augur.getString = function (key, f) {
        return json_rpc(postdata("getString", ["augur", key], "db_"), f);
    };
    augur.newIdentity = function (f) {
        return json_rpc(postdata("newIdentity", null, "shh_"), f);
    };
    augur.post = function (params, f) {
        return json_rpc(postdata("post", params, "shh_"), f);
    };
    augur.whisperFilter = function (params, f) {
        return json_rpc(postdata("newFilter", params, "shh_"), f);
    };
    augur.commentFilter = function (market, f) {
        return augur.whisperFilter({ topics: [ market ]}, f);
    };
    augur.uninstallFilter = function (filter, f) {
        return json_rpc(postdata("uninstallFilter", filter, "shh_"), f);
    };
    /**
     * Incoming comment filter:
     *  - compare comment string length, write the longest to leveldb
     *  - 10 second ethereum network polling interval
     */
    augur.pollFilter = function (market_id, filter_id) {
        var incoming_comments, stored_comments, num_messages, incoming_parsed, stored_parsed;
        augur.getFilterChanges(filter_id, function (message) {
            if (message) {
                num_messages = message.length;
                if (num_messages) {
                    for (var i = 0; i < num_messages; ++i) {
                        log("\n\nPOLLFILTER: reading incoming message " + i.toString());
                        incoming_comments = augur.decode_hex(message[i].payload);
                        if (incoming_comments) {
                            incoming_parsed = JSON.parse(incoming_comments);
                            log(incoming_parsed);
                
                            // get existing comment(s) stored locally
                            stored_comments = augur.getString(market_id);

                            // check if incoming comments length > stored
                            if (stored_comments && stored_comments.length) {
                                stored_parsed = JSON.parse(stored_comments);
                                if (incoming_parsed.length > stored_parsed.length ) {
                                    log(incoming_parsed.length.toString() + " incoming comments");
                                    log("[" + filter_id + "] overwriting comments for market: " + market_id);
                                    if (augur.putString(market_id, incoming_comments)) {
                                        log("[" + filter_id + "] overwrote comments for market: " + market_id);
                                    }
                                } else {
                                    log(stored_parsed.length.toString() + " stored comments");
                                    log("[" + filter_id + "] retaining comments for market: " + market_id);
                                }
                            } else {
                                log(incoming_parsed.length.toString() + " incoming comments");
                                log("[" + filter_id + "] inserting first comments for market: " + market_id);
                                if (augur.putString(market_id, incoming_comments)) {
                                    log("[" + filter_id + "] overwrote comments for market: " + market_id);
                                }
                            }
                        }
                    }
                }
            }
            // wait a few seconds, then poll the filter for new messages
            setTimeout(function () {
                augur.pollFilter(market_id, filter_id);
            }, augur.COMMENT_POLL_INTERVAL);
        });
    };
    augur.initComments = function (market) {
        var filter, comments, whisper_id;

        // make sure there's only one filter per market
        if (augur.filters[market] && augur.filters[market].filterId) {
            // log("existing filter found");
            augur.pollFilter(market, augur.filters[market].filterId);
        } else {

            // create filter for this market
            filter = augur.commentFilter(market);
            if (filter && filter !== "0x") {
                // log("creating new filter");
                augur.filters[market] = {
                    filterId: filter,
                    polling: false
                };
                augur.filters[market].polling = true;
    
                // broadcast all comments in local leveldb
                comments = augur.getString(market);
                if (comments) {
                    whisper_id = augur.newIdentity();
                    if (whisper_id) {
                        var transmission = {
                            from: whisper_id,
                            topics: [market],
                            payload: augur.prefix_hex(augur.encode_hex(comments)),
                            priority: "0x64",
                            ttl: "0x500" // time-to-live (until expiration) in seconds
                        };
                        if (augur.post(transmission)) {
                            log("comments sent successfully");
                        }
                    }
                }
                augur.pollFilter(market, filter);
                return filter;
            }
        }
    };
    augur.resetComments = function (market) {
        return augur.putString(market, "");
    };
    augur.getMarketComments = function (market) {
        var comments = augur.getString(market);
        if (comments) {
            return JSON.parse(comments);
        } else {
            log("no commments found");
        }
    };
    augur.addMarketComment = function (pkg) {
        var market, comment_text, author, updated, transmission, whisper_id, comments;
        market = pkg.marketId;
        comment_text = pkg.message;
        author = pkg.author || augur.coinbase;

        whisper_id = augur.newIdentity();
        if (whisper_id) {
            updated = JSON.stringify([{
                whisperId: whisper_id,
                from: author, // ethereum account
                comment: comment_text,
                time: Math.floor((new Date()).getTime() / 1000)
            }]);

            // get existing comment(s) stored locally
            // (note: build with DFATDB=1 if DBUNDLE=minimal)
            comments = augur.getString(market);
            if (comments) {
                updated = updated.slice(0,-1) + "," + comments.slice(1);
            }
            if (augur.putString(market, updated)) {
                log("comment added to leveldb");
            }
            transmission = {
                from: whisper_id,
                topics: [market],
                payload: augur.prefix_hex(augur.encode_hex(updated)),
                priority: "0x64",
                ttl: "0x600" // 10 minutes
            };
            if (augur.post(transmission)) {
                log("comment sent successfully");
            }
            return JSON.parse(augur.decode_hex(transmission.payload));
        }
    };

    return augur;

})(Augur || {});

if (MODULAR) module.exports = Augur;
