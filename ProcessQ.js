'use strict';

var GT = GT || {};

(function(exports) {

    var ProcessQ = function(cfg) {
        for (var key in cfg) {
            this[key] = cfg[key]
        }
        var Me = this;
        this.callRun = function() {
            Me.run();
        };
        this.timer = {};
    };
    ProcessQ.types = {};

    ProcessQ.prototype = {

        constructor: ProcessQ,

        interval: 20,

        ignoreError: true,
        delay: 0,
        defaultType: "fn",

        parallel: false,
        wrapAudio: false,
        rootPath: null,

        defaultItemIsFinished: function() {
            return true;
        },

        init: function() {
            this.resultPool = {};

            var items = this.items || [];
            this.items = [];
            this.itemCount = 0;
            this.totalWeight = 0;

            for (var i = 0, len = items.length; i < len; i++) {
                var item = items[i];
                this.addItem(item);
            }

            if (this.onInit != null) {
                this.onInit();
            }
        },
        onInit: null,

        timerStart: function() {
            var timer = this.timer;
            timer.current = Date.now();
            timer.start = timer.last = timer.current;
            timer.delta = 0;
            timer.duration = 0;
        },

        timerTick: function() {
            var timer = this.timer;
            timer.last = timer.current;
            timer.current = Date.now();
            timer.delta = timer.current - timer.last;
            timer.duration += timer.delta;
        },

        addItem: function(item) {
            var options = item;
            item = {};
            for (var key in options) {
                item[key] = options[key];
            }
            item.options = options;

            item.src = item.src || item.url;

            item.id = item.id || item.src || "id_" + (this.items.length + 1);

            var type = item.type || this.defaultType;
            if (type) {
                item = new ProcessQ.types[type](item);
            }
            if (this.rootPath) {
                if (this.rootPath[this.rootPath.length - 1] != "/") {
                    this.rootPath += "/";
                }
            } else {
                this.rootPath = "";
            }
            if (item.src) {
                if (item.src[0] == "/") {
                    item.src = item.src.substring(1);
                }
                item.src = this.rootPath + item.src;
            }

            item.delay = isNaN(item.delay) ? this.delay : Number(item.delay);
            item.weight = isNaN(item.weight) || item.weight === 0 ? 1 : Number(item.weight);
            item.isFinished = item.isFinished || this.defaultItemIsFinished;
            this.totalWeight += item.weight;
            this.items.push(item);
            this.itemCount = this.items.length;
        },

        start: function() {
            this.paused = false;
            this.itemIndex = 0;
            this.itemCount = this.items.length;
            this.finishedItems = {};
            this.finishedCount = 0;
            this.finishedWeight = 0;
            var Me = this;
            setTimeout(function() {
                Me.timerStart();
                Me.activeItem(0);
                Me.run();
            }, 20);
        },

        run: function() {
            var Me = this;

            var totalCount = this.itemCount;
            var timeStep = this.delay || 10;

            var parallelCount = !this.parallel ? 1 : (typeof this.parallel == "number" ? this.parallel : (totalCount >> 2));

            parallelCount = Math.min(totalCount, parallelCount || 1);
            var paralleled = 0;
            var paralleledIdle = parallelCount;

            var finishedItems = this.finishedItems;
            var lastFinished = null;

            Me.blockItem = null;

            function check() {
                var totalCount = Me.items.length;
                if (Me.finishedCount >= totalCount) {
                    Me.finish();
                } else {
                    if (Me.paused) {
                        Me.onPausing(timeStep);
                        return;
                    }
                    if (!Me.blockItem) {
                        for (var i = 0; i < paralleledIdle; i++) {
                            if (paralleled >= totalCount) {
                                break;
                            }
                            var item = Me.items[paralleled];
                            item.start(Me);
                            paralleledIdle--;
                            paralleled++;
                            if (item.block) {
                                Me.blockItem = item;
                                break;
                            }
                        }
                    }

                    for (var idx = 0; idx < paralleled; idx++) {
                        if (idx >= totalCount) {
                            break;
                        }
                        var finished = false;
                        var item = Me.items[idx];
                        if (!finishedItems[idx] && item.isFinished(Me)) {
                            finished = true;
                            Me._onItemFinish(item, Me);
                        } else if (item.isError && item.isError(Me)) {
                            Me._onItemError(item, Me);
                            if (Me.ignoreError) {
                                finishedItems[idx] = -1;
                                finished = true;
                                Me.finishedCount += 1;
                                Me.finishedWeight += item.weight;
                            }
                        }
                        if (finished) {
                            paralleledIdle++;
                            finishedItems[idx] = 1;
                            if (Me.blockItem === item) {
                                Me.blockItem = null;
                            }
                        } else if (item.update) {
                            item.update(timeStep, Me);
                        }
                    }

                    var currentFinished = Me.finishedWeight;
                    if (currentFinished !== lastFinished) {
                        Me.onProgressing(timeStep, Me);
                        lastFinished = currentFinished;
                    }
                    setTimeout(check, timeStep);
                }
            }
            check();
        },

        finish: function() {
            clearTimeout(this.mainLoop);
            if (this.onFinish != null) {
                this.onFinish(this);
            }
        },
        onFinish: null,

        getItem: function(index) {
            return this.items[index];
        },

        activeItem: function(index) {
            this.itemIndex = index;
            this.currentItem = this.getItem(index);
            if (this.currentItem) {
                this.currentItem._delay = this.currentItem.delay;
                if (this.currentItem._delay == 0) {
                    this.currentItem.start(this);
                    this.currentItem._started = true;
                }
            }
        },

        _onItemFinish: function(item, queue) {
            if (item.onFinish) {
                item.onFinish(queue);
            }
            var result;
            if (item.getResult) {
                result = item.getResult();
                this.resultPool[item.id] = result;
            }
            this.finishedCount += 1;
            this.finishedWeight += item.weight;
            this.onItemFinish(item, result, queue);
        },

        onItemFinish: function(item, result, queue) {

        },

        _onItemError: function(item, queue) {
            var errorEvent = item.errorEvent;
            if (item.onError) {
                item.onError(errorEvent, queue);
            }
            item.errorEvent = null;
            this.onItemError(item, errorEvent, queue)
        },

        onItemError: function(item, errorEvent, queue) {

        },

        onProgressing: function(timeStep, queue) {

        },


        getUnfinishedItems: function() {
            var list = [];
            var Me = this;
            this.items.forEach(function(item) {
                if (!item.isFinished(Me)) {
                    list.push(item);
                }
            });
            return list;
        }

    };


    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////


    var FunctionLoader = function(cfg) {
        for (var key in cfg) {
            this[key] = cfg[key]
        }
    }
    ProcessQ.types["fn"] = FunctionLoader;

    FunctionLoader.prototype = {
        constructor: FunctionLoader,
        id: null,
        async: false,
        block: false,
        errorEvent: null,

        fn: function(queue) {

        },

        start: function(queue) {
            this.finished = this.async;
            // this.finished = true;
            this.result = this.fn(queue);
        },

        // function(timeStep, queue)
        update: null,

        onFinish: function(queue) {

        },

        getResult: function() {
            return this.result;
        },

        isFinished: function(queue) {
            return this.finished;
        },

        isError: function(queue) {
            return this.errorEvent;
        }

    };


    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////



    var ImageLoader = function(cfg) {
        for (var key in cfg) {
            this[key] = cfg[key]
        }
    }
    ProcessQ.types["img"] = ImageLoader;

    ImageLoader.prototype = {
        constructor: ImageLoader,
        id: null,
        src: null,
        finished: false,
        async: false,
        block: false,
        lazy: false,
        errorEvent: null,

        start: function(queue) {
            if (this.lazy) {
                this.finished = true;
                return;
            }
            var img = this.img = new Image();
            this.finished = this.async;
            img.loader = this;
            img.addEventListener("load", this._onLoad);
            img.addEventListener("error", this._onError);
            img.src = this.src;
            this.loading = true;
        },

        _onLoad: function(event) {
            var img = this;
            img.removeEventListener("load", img.loader._onLoad);
            img.loaded = true;
            img.loader.finished = true;
            img.loader.loading = false;
            img.loader.onLoad(img, event);
            delete img.loader;
        },
        onLoad: function(img, event) {

        },
        _onError: function(event) {
            var img = this;
            img.removeEventListener("error", img.loader._onError);
            img.loaded = false;
            img.loader.finished = false;
            img.loader.errorEvent = event;
            img.loader.onError(img, event);
            delete img.loader;
        },
        onError: function(img, event) {

        },

        getResult: function() {
            if (this.lazy) {
                return this;
            }
            return this.img;
        },

        onFinish: function(queue) {

        },

        isFinished: function(queue) {
            return this.finished;
        },

        isError: function(queue) {
            return this.errorEvent;
        }

    };


    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////


    var AudioLoader = function(cfg) {
        for (var key in cfg) {
            this[key] = cfg[key]
        }
    };

    AudioLoader.formats = {
        "mp3": 'audio/mpeg',
        "ogg": 'audio/ogg; codecs=vorbis',
    };
    ProcessQ.types["audio"] = AudioLoader;


    (function() {

        var test = new Audio();
        for (var ext in AudioLoader.formats) {
            if (test.canPlayType(AudioLoader.formats[ext])) {
                AudioLoader.supportFormat = ext;
                break;
            }
        }
    }());


    AudioLoader.prototype = {
        constructor: AudioLoader,
        id: null,
        src: null,
        finished: false,
        async: false,
        block: false,
        lazy: false,
        errorEvent: null,
        wrap: null,
        ignoreIOS: true,
        isIOS: function() {
            if (typeof window != "undefined" && window.navigator && window.navigator.userAgent && window.navigator.userAgent.toLowerCase) {
                var ua = window.navigator.userAgent.toLowerCase();
                var iPhone = /iphone/.test(ua);
                var iPad = /ipad/.test(ua);
                var iPod = /ipod/.test(ua);
                var iOS = iPhone || iPad || iPod;
                var l = window.location;
                var inBroswer = l && l.replace && l.reload;
                return iOS && inBroswer;
            }
            return false;
        },
        start: function(queue) {
            if (this.lazy) {
                this.finished = true;
                return;
            }
            this.wrap = this.wrap === null ? queue.wrapAudio : this.wrap;
            this.finished = this.async;

            if (this.ignoreIOS && this.isIOS()) {
                this.finished = true;
                this.wrap = false;
                this.audio = null;
                return;
            }
            var src;
            if (this.src.indexOf("." + AudioLoader.supportFormat) == -1) {
                src = this.src + "." + AudioLoader.supportFormat;
            } else {
                src = this.src;
            }
            this.createAudio(src);
            this.loading = true;
        },

        createAudio: function(src) {
            var audio = this.audio = new Audio();
            audio.src = src;
            audio.loop = this.loop || false;
            if (this.volume) {
                audio.volume = this.volume;
            }
            audio.preload = "auto";
            audio.autobuffer = true;
            audio.autoplay = false;

            audio.loader = this;
            audio.addEventListener("canplaythrough", this._onLoad);
            audio.addEventListener("error", this._onError);
            audio.load();
            return audio;
        },

        _onLoad: function(event) {
            this.removeEventListener("canplaythrough", this.loader._onLoad);
            this.loaded = true;
            this.loader.finished = true;
            this.loader.loading = false;
            this.loader.onLoad(this, event);
            delete this.loader;
        },
        onLoad: function(audio, event) {

        },

        _onError: function(event) {
            this.removeEventListener("error", this.loader._onError);
            this.loaded = false;
            this.loader.finished = false;
            this.loader.errorEvent = event;
            this.loader.onError(this, event);
            delete this.loader;
        },
        onError: function(audio, event) {

        },

        getResult: function() {
            if (this.lazy) {
                return this;
            }
            return this.audio;
        },

        isFinished: function(queue) {
            return this.finished;
        },

        isError: function(queue) {
            return this.errorEvent;
        },

    };

    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////


    exports.ProcessQ = ProcessQ;
    // exports.FunctionLoader = FunctionLoader;
    // exports.ImageLoader = ImageLoader;
    // exports.AudioLoader = AudioLoader;

}(GT));
