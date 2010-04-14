/*  Kata Javascript Utilities
 *  WebWorker.js
 *
 *  Copyright (c) 2010, Patrick Reiter Horn
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are
 *  met:
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in
 *    the documentation and/or other materials provided with the
 *    distribution.
 *  * Neither the name of Sirikata nor the names of its contributors may
 *    be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
 * OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

Kata.include("SimpleChannel.js");

(function() {
    /** @variable {boolean} If true, uses Workers on supported Javascript
     * engines. If false, never uses workers, and runs code synchronously.
     */
    Kata.WEB_WORKERS_ENABLED = false;

    function getErrorCallback(thus) {
        return function(ev) {
            thus.gotError(ev.message, ev.filename, ev.lineno);
        }
    }

    if (Kata.WEB_WORKERS_ENABLED && typeof(Worker)!="undefined") {
        /**
         * WebWorker is a class to create another subprocess, and manage the
         * bootstrapping process when Workers are enabled.
         * To avoid race conditions, the code is not executed until you call
         * the go() method on this WebWorker object.
         * @see GenericWorker.js
         * @constructor
         * @param {string} jsFile  An initial javascript file to be imported.
         * @param {string} clsName  A dot-separated path to the class from
         *     "self" (the root object). Actual classes can not be sent across
         *     the thread boundary, which is why this needs the name.
         * @param {*} args  Primitive data to instantiate the class with.
         */
        Kata.WebWorker = function (jsFile, clsName, args) {
            this.mWorker = new Worker(Kata.scriptRoot+"GenericWorker.js");
            this.mWorker.onerror = getErrorCallback(this);
            this.mInitialMessage = [
                Kata.scriptRoot,
                jsFile,
                clsName,
                args];
            this.mChannel = new Kata.WebWorker.Channel(this.mWorker);
        };
        /** Runs the WebWorker. At this point, it is possible to receive a
         *  message synchronously, so make sure to set up all listeners before
         *  calling the go method.
         */
        Kata.WebWorker.prototype.go = function() {
            var initMsg = this.mInitialMessage;
            delete this.mInitialMessage;
            this.mWorker.postMessage(initMsg);
        };
    } else {
        /**
         * WebWorker is a class to create another subprocess, and manage the
         * bootstrapping process, in this case when Workers are disabled.
         * To avoid race conditions, the code is not executed until you call
         * the go() method on this WebWorker object.
         * @constructor
         * @param {string} jsFile  An initial javascript file to be imported.
         * @param {string} clsName  A dot-separated path to the class from
         *     "self" (the root object). Actual classes can not be sent across
         *     the thread boundary, which is why this needs the name.
         * @param {*} args  Primitive data to instantiate the class with.
         */
        Kata.WebWorker = function (jsFile, clsName, args) {
            this.mChannel = new Kata.SimpleChannel;
            var clsTree = clsName.split(".");
            Kata.include(jsFile);
            var cls = self;
            for (var i = 0; cls && i < clsTree.length; i++) {
                cls = cls[clsTree[i]];
            }
            this.mArgs = args;
            this.mClass = cls;
            if (!cls) {
                Kata.error(clsName+" is undefined.");
            }
            if (network_debug) console.log("new webworker");
        }
        /** Runs the WebWorker. At this point, it is possible to receive a
         *  message synchronously, so make sure to set up all listeners before
         *  calling the go method.
         */
        Kata.WebWorker.prototype.go = function() {
            var opposingChannel=new Kata.SimpleChannel(this.mChannel);
            var cls = this.mClass;
            if (network_debug) console.log("going!");
            this.mChild = new cls (
                opposingChannel,
                this.mArgs);
            delete this.mArgs;
        }
    }

    /**
     * @return {Kata.Channel} The Channel to correspond with the worker.
     * You should subscribe listeners to this channel before executing, but
     * you cannot send any messages until you have called the go() method.
     */
    Kata.WebWorker.prototype.getChannel = function() {
        return this.mChannel;
    }
    /**
     * Report an error sent from the worker. This is the only way for error
     * information to be propegated to the master thread.
     *
     * @param data  Some error message
     * @param file  Javascript filename
     * @param line  Javascript line number
     */
    Kata.WebWorker.prototype.gotError = function (data,file,line) {
        Kata.error("ERROR at "+file+":"+line+": "+data);
    };

})();
(function() {
    function getCallback(thus) {
        return function(ev) {
            thus.callListeners(ev.data);
        };
    }

    var SUPER = Kata.Channel.prototype;
    /**
     * WebWorker.Channel is a channel that uses the postMessage function
     * and the onmessage listener defined as part of the Worker interface and
     * the DedicatedWorkerGlobalScope interface (if you pass in 'self')
     * @constructor
     * @extends {Kata.Channel}
     * @param {DedicatedWorkerGlobalScope|Worker} port  Object implementing the
     *     MessagePort interface (see the Web Workers specification).
     */
    Kata.WebWorker.Channel = function (port) {
        SUPER.constructor.call(this);
        this.mMessagePort = port;
        this.mMessagePort.onmessage = getCallback(this);
    };
    Kata.extend(Kata.WebWorker.Channel, SUPER);

    /**
     * @return {string|object} Some data to be sent across the thread boundary.
     */
    Kata.WebWorker.Channel.prototype.sendMessage = function (data) {
        this.mMessagePort.postMessage(data);
    };

})();
