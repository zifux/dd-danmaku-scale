(async function () {
    'use strict';

    // danmaku弹幕渲染库 4 - 640
    // https://cdn.jsdelivr.net/npm/danmaku/dist/danmaku.canvas.js
    // 添加透明度控制
    (function (global, factory) {
        typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
            typeof define === 'function' && define.amd ? define(factory) :
                (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Danmaku = factory());
    }(this, (function () {
        'use strict';

        var transform = (function () {
            /* istanbul ignore next */
            if (typeof document === 'undefined') return 'transform';
            var properties = [
                'oTransform', // Opera 11.5
                'msTransform', // IE 9
                'mozTransform',
                'webkitTransform',
                'transform'
            ];
            var style = document.createElement('div').style;
            for (var i = 0; i < properties.length; i++) {
                /* istanbul ignore else */
                if (properties[i] in style) {
                    return properties[i];
                }
            }
            /* istanbul ignore next */
            return 'transform';
        }());

        var dpr = typeof window !== 'undefined' && window.devicePixelRatio || 1;

        var canvasHeightCache = Object.create(null);

        function canvasHeight(font, fontSize) {
            if (canvasHeightCache[font]) {
                return canvasHeightCache[font];
            }
            var height = 12;
            var regex = /(\d+(?:\.\d+)?)(px|%|em|rem)(?:\s*\/\s*(\d+(?:\.\d+)?)(px|%|em|rem)?)?/;
            var p = font.match(regex);
            if (p) {
                var fs = p[1] * 1 || 10;
                var fsu = p[2];
                var lh = p[3] * 1 || 1.2;
                var lhu = p[4];
                if (fsu === '%') fs *= fontSize.container / 100;
                if (fsu === 'em') fs *= fontSize.container;
                if (fsu === 'rem') fs *= fontSize.root;
                if (lhu === 'px') height = lh;
                if (lhu === '%') height = fs * lh / 100;
                if (lhu === 'em') height = fs * lh;
                if (lhu === 'rem') height = fontSize.root * lh;
                if (lhu === undefined) height = fs * lh;
            }
            canvasHeightCache[font] = height;
            return height;
        }

        function createCommentCanvas(cmt, fontSize) {
            if (typeof cmt.render === 'function') {
                var cvs = cmt.render();
                if (cvs instanceof HTMLCanvasElement) {
                    cmt.width = cvs.width;
                    cmt.height = cvs.height;
                    return cvs;
                }
            }
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            var style = cmt.style || {};
            style.font = style.font || '10px sans-serif';
            style.textBaseline = style.textBaseline || 'bottom';
            var strokeWidth = style.lineWidth * 1;
            strokeWidth = (strokeWidth > 0 && strokeWidth !== Infinity)
                ? Math.ceil(strokeWidth)
                : !!style.strokeStyle * 1;
            ctx.font = style.font;
            cmt.width = cmt.width ||
                Math.max(1, Math.ceil(ctx.measureText(cmt.text).width) + strokeWidth * 2);
            cmt.height = cmt.height ||
                Math.ceil(canvasHeight(style.font, fontSize)) + strokeWidth * 2;
            canvas.width = cmt.width * dpr;
            canvas.height = cmt.height * dpr;
            ctx.scale(dpr, dpr);
            for (var key in style) {
                ctx[key] = style[key];
            }
            var baseline = 0;
            switch (style.textBaseline) {
                case 'top':
                case 'hanging':
                    baseline = strokeWidth;
                    break;
                case 'middle':
                    baseline = cmt.height >> 1;
                    break;
                default:
                    baseline = cmt.height - strokeWidth;
            }
            if (style.strokeStyle) {
                ctx.strokeText(cmt.text, strokeWidth, baseline);
            }
            ctx.fillText(cmt.text, strokeWidth, baseline);
            return canvas;
        }

        function computeFontSize(el) {
            return window
                .getComputedStyle(el, null)
                .getPropertyValue('font-size')
                .match(/(.+)px/)[1] * 1;
        }

        function init(container) {
            var stage = document.createElement('canvas');
            stage.context = stage.getContext('2d');
            stage._fontSize = {
                root: computeFontSize(document.getElementsByTagName('html')[0]),
                container: computeFontSize(container)
            };
            return stage;
        }

        function clear(stage, comments) {
            stage.context.clearRect(0, 0, stage.width, stage.height);
            // avoid caching canvas to reduce memory usage
            for (var i = 0; i < comments.length; i++) {
                comments[i].canvas = null;
            }
        }

        function resize(stage, width, height) {
            stage.width = width * dpr;
            stage.height = height * dpr;
            stage.style.width = width + 'px';
            stage.style.height = height + 'px';
        }

        function framing(stage) {
            stage.context.clearRect(0, 0, stage.width, stage.height);
        }

        function setup(stage, comments) {
            for (var i = 0; i < comments.length; i++) {
                var cmt = comments[i];
                cmt.canvas = createCommentCanvas(cmt, stage._fontSize);
            }
        }

        function render(stage, cmt) {
            stage.context.drawImage(cmt.canvas, cmt.x * dpr, cmt.y * dpr);
        }

        function remove(stage, cmt) {
            // avoid caching canvas to reduce memory usage
            cmt.canvas = null;
        }

        var canvasEngine = {
            name: 'canvas',
            init: init,
            clear: clear,
            resize: resize,
            framing: framing,
            setup: setup,
            render: render,
            remove: remove,
        };

        /* eslint no-invalid-this: 0 */
        function allocate(cmt) {
            var that = this;
            var ct = this.media ? this.media.currentTime : Date.now() / 1000;
            var pbr = this.media ? this.media.playbackRate : 1;
            function willCollide(cr, cmt) {
                if (cmt.mode === 'top' || cmt.mode === 'bottom') {
                    return ct - cr.time < that._.duration;
                }
                var crTotalWidth = that._.width + cr.width;
                var crElapsed = crTotalWidth * (ct - cr.time) * pbr / that._.duration;
                if (cr.width > crElapsed) {
                    return true;
                }
                // (rtl mode) the right end of `cr` move out of left side of stage
                var crLeftTime = that._.duration + cr.time - ct;
                var cmtTotalWidth = that._.width + cmt.width;
                var cmtTime = that.media ? cmt.time : cmt._utc;
                var cmtElapsed = cmtTotalWidth * (ct - cmtTime) * pbr / that._.duration;
                var cmtArrival = that._.width - cmtElapsed;
                // (rtl mode) the left end of `cmt` reach the left side of stage
                var cmtArrivalTime = that._.duration * cmtArrival / (that._.width + cmt.width);
                return crLeftTime > cmtArrivalTime;
            }
            var crs = this._.space[cmt.mode];
            var last = 0;
            var curr = 0;
            for (var i = 1; i < crs.length; i++) {
                var cr = crs[i];
                var requiredRange = cmt.height;
                if (cmt.mode === 'top' || cmt.mode === 'bottom') {
                    requiredRange += cr.height;
                }
                if (cr.range - cr.height - crs[last].range >= requiredRange) {
                    curr = i;
                    break;
                }
                if (willCollide(cr, cmt)) {
                    last = i;
                }
            }
            var channel = crs[last].range;
            var crObj = {
                range: channel + cmt.height,
                time: this.media ? cmt.time : cmt._utc,
                width: cmt.width,
                height: cmt.height
            };
            crs.splice(last + 1, curr - last - 1, crObj);

            if (cmt.mode === 'bottom') {
                return this._.height - cmt.height - channel % this._.height;
            }
            return channel % (this._.height - cmt.height);
        }

        /* eslint no-invalid-this: 0 */
        function createEngine(framing, setup, render, remove) {
            return function () {
                framing(this._.stage);
                var dn = Date.now() / 1000;
                var ct = this.media ? this.media.currentTime : dn;
                var pbr = this.media ? this.media.playbackRate : 1;
                var cmt = null;
                var cmtt = 0;
                var i = 0;
                for (i = this._.runningList.length - 1; i >= 0; i--) {
                    cmt = this._.runningList[i];
                    cmtt = this.media ? cmt.time : cmt._utc;
                    if (ct - cmtt > this._.duration) {
                        remove(this._.stage, cmt);
                        this._.runningList.splice(i, 1);
                    }
                }
                var pendingList = [];
                while (this._.position < this.comments.length) {
                    cmt = this.comments[this._.position];
                    cmtt = this.media ? cmt.time : cmt._utc;
                    if (cmtt >= ct) {
                        break;
                    }
                    // when clicking controls to seek, media.currentTime may changed before
                    // `pause` event is fired, so here skips comments out of duration,
                    // see https://github.com/weizhenye/Danmaku/pull/30 for details.
                    if (ct - cmtt > this._.duration) {
                        ++this._.position;
                        continue;
                    }
                    if (this.media) {
                        cmt._utc = dn - (this.media.currentTime - cmt.time);
                    }
                    pendingList.push(cmt);
                    ++this._.position;
                }
                setup(this._.stage, pendingList);
                for (i = 0; i < pendingList.length; i++) {
                    cmt = pendingList[i];
                    cmt.y = allocate.call(this, cmt);
                    this._.runningList.push(cmt);
                }
                let ctx = this._.stage.context;
                ctx.save();
                ctx.globalAlpha = this._.alpha;
                for (i = 0; i < this._.runningList.length; i++) {
                    cmt = this._.runningList[i];
                    var totalWidth = this._.width + cmt.width;
                    var elapsed = totalWidth * (dn - cmt._utc) * pbr / this._.duration;
                    if (cmt.mode === 'ltr') cmt.x = (elapsed - cmt.width + .5) | 0;
                    if (cmt.mode === 'rtl') cmt.x = (this._.width - elapsed + .5) | 0;
                    if (cmt.mode === 'top' || cmt.mode === 'bottom') {
                        cmt.x = (this._.width - cmt.width) >> 1;
                    }
                    render(this._.stage, cmt);
                }
                ctx.restore();
            };
        }

        var raf =
            (
                typeof window !== 'undefined' &&
                (
                    window.requestAnimationFrame ||
                    window.mozRequestAnimationFrame ||
                    window.webkitRequestAnimationFrame
                )
            ) ||
            function (cb) {
                return setTimeout(cb, 50 / 3);
            };

        var caf =
            (
                typeof window !== 'undefined' &&
                (
                    window.cancelAnimationFrame ||
                    window.mozCancelAnimationFrame ||
                    window.webkitCancelAnimationFrame
                )
            ) ||
            clearTimeout;

        function binsearch(arr, prop, key) {
            var mid = 0;
            var left = 0;
            var right = arr.length;
            while (left < right - 1) {
                mid = (left + right) >> 1;
                if (key >= arr[mid][prop]) {
                    left = mid;
                } else {
                    right = mid;
                }
            }
            if (arr[left] && key < arr[left][prop]) {
                return left;
            }
            return right;
        }


        function formatMode(mode) {
            if (!/^(ltr|top|bottom)$/i.test(mode)) {
                return 'rtl';
            }
            return mode.toLowerCase();
        }

        function collidableRange() {
            var max = 9007199254740991;
            return [
                { range: 0, time: -max, width: max, height: 0 },
                { range: max, time: max, width: 0, height: 0 }
            ];
        }

        function resetSpace(space) {
            space.ltr = collidableRange();
            space.rtl = collidableRange();
            space.top = collidableRange();
            space.bottom = collidableRange();
        }

        /* eslint no-invalid-this: 0 */
        function play() {
            if (!this._.visible || !this._.paused) {
                return this;
            }
            this._.paused = false;
            if (this.media) {
                for (var i = 0; i < this._.runningList.length; i++) {
                    var cmt = this._.runningList[i];
                    cmt._utc = Date.now() / 1000 - (this.media.currentTime - cmt.time);
                }
            }
            var that = this;
            var engine = createEngine(
                this._.engine.framing.bind(this),
                this._.engine.setup.bind(this),
                this._.engine.render.bind(this),
                this._.engine.remove.bind(this)
            );
            function frame() {
                engine.call(that);
                that._.requestID = raf(frame);
            }
            this._.requestID = raf(frame);
            return this;
        }

        /* eslint no-invalid-this: 0 */
        function pause() {
            if (!this._.visible || this._.paused) {
                return this;
            }
            this._.paused = true;
            caf(this._.requestID);
            this._.requestID = 0;
            return this;
        }

        /* eslint no-invalid-this: 0 */
        function seek() {
            if (!this.media) {
                return this;
            }
            this.clear();
            resetSpace(this._.space);
            var position = binsearch(this.comments, 'time', this.media.currentTime);
            this._.position = Math.max(0, position - 1);
            return this;
        }

        /* eslint no-invalid-this: 0 */
        function bindEvents(_) {
            _.play = play.bind(this);
            _.pause = pause.bind(this);
            _.seeking = seek.bind(this);
            this.media.addEventListener('play', _.play);
            this.media.addEventListener('pause', _.pause);
            this.media.addEventListener('playing', _.play);
            this.media.addEventListener('waiting', _.pause);
            this.media.addEventListener('seeking', _.seeking);
        }

        /* eslint no-invalid-this: 0 */
        function unbindEvents(_) {
            this.media.removeEventListener('play', _.play);
            this.media.removeEventListener('pause', _.pause);
            this.media.removeEventListener('playing', _.play);
            this.media.removeEventListener('waiting', _.pause);
            this.media.removeEventListener('seeking', _.seeking);
            _.play = null;
            _.pause = null;
            _.seeking = null;
        }

        /* eslint-disable no-invalid-this */
        function init$1(opt) {
            this._ = {};
            this.container = opt.container || document.createElement('div');
            this.media = opt.media;
            this._.visible = true;
            /* istanbul ignore next */
            {
                this.engine = 'canvas';
                this._.engine = canvasEngine;
            }
            /* eslint-enable no-undef */
            this._.requestID = 0;

            this._.speed = Math.max(0, opt.speed) || 144;
            this._.alpha = Math.max(0, Math.min(1, opt.alpha)) || 1;
            this._.duration = 4;

            this.comments = opt.comments || [];
            this.comments.sort(function (a, b) {
                return a.time - b.time;
            });
            for (var i = 0; i < this.comments.length; i++) {
                this.comments[i].mode = formatMode(this.comments[i].mode);
            }
            this._.runningList = [];
            this._.position = 0;

            this._.paused = true;
            if (this.media) {
                this._.listener = {};
                bindEvents.call(this, this._.listener);
            }

            this._.stage = this._.engine.init(this.container);
            this._.stage.style.cssText += 'position: absolute;pointer-events: none;left: 0;top: 0;';

            this.resize();
            this.container.appendChild(this._.stage);

            this._.space = {};
            resetSpace(this._.space);

            if (!this.media || !this.media.paused) {
                seek.call(this);
                play.call(this);
            }
            return this;
        }

        /* eslint-disable no-invalid-this */
        function destroy() {
            if (!this.container) {
                return this;
            }

            pause.call(this);
            this.clear();
            this.container.removeChild(this._.stage);
            if (this.media) {
                unbindEvents.call(this, this._.listener);
            }
            for (var key in this) {
                /* istanbul ignore else  */
                if (Object.prototype.hasOwnProperty.call(this, key)) {
                    this[key] = null;
                }
            }
            return this;
        }

        var properties = ['mode', 'time', 'text', 'render', 'style'];

        /* eslint-disable no-invalid-this */
        function emit(obj) {
            if (!obj || Object.prototype.toString.call(obj) !== '[object Object]') {
                return this;
            }
            var cmt = {};
            for (var i = 0; i < properties.length; i++) {
                if (obj[properties[i]] !== undefined) {
                    cmt[properties[i]] = obj[properties[i]];
                }
            }
            cmt.text = (cmt.text || '').toString();
            cmt.mode = formatMode(cmt.mode);
            cmt._utc = Date.now() / 1000;
            if (this.media) {
                var position = 0;
                if (cmt.time === undefined) {
                    cmt.time = this.media.currentTime;
                    position = this._.position;
                } else {
                    position = binsearch(this.comments, 'time', cmt.time);
                    if (position < this._.position) {
                        this._.position += 1;
                    }
                }
                this.comments.splice(position, 0, cmt);
            } else {
                this.comments.push(cmt);
            }
            return this;
        }

        /* eslint-disable no-invalid-this */
        function show() {
            if (this._.visible) {
                return this;
            }
            this._.visible = true;
            if (this.media && this.media.paused) {
                return this;
            }
            seek.call(this);
            play.call(this);
            return this;
        }

        /* eslint-disable no-invalid-this */
        function hide() {
            if (!this._.visible) {
                return this;
            }
            pause.call(this);
            this.clear();
            this._.visible = false;
            return this;
        }

        /* eslint-disable no-invalid-this */
        function clear$1() {
            this._.engine.clear(this._.stage, this._.runningList);
            this._.runningList = [];
            return this;
        }

        /* eslint-disable no-invalid-this */
        function resize$1() {
            this._.width = this.container.offsetWidth;
            this._.height = this.container.offsetHeight;
            this._.engine.resize(this._.stage, this._.width, this._.height);
            this._.duration = this._.width / this._.speed;
            return this;
        }

        var speed = {
            get: function () {
                return this._.speed;
            },
            set: function (s) {
                if (typeof s !== 'number' ||
                    isNaN(s) ||
                    !isFinite(s) ||
                    s <= 0) {
                    return this._.speed;
                }
                this._.speed = s;
                if (this._.width) {
                    this._.duration = this._.width / s;
                }
                return s;
            }
        };

        var alpha = {
            get: function () {
                return this._.alpha;
            },
            set: function (s) {
                if (typeof s !== 'number' ||
                    isNaN(s) ||
                    !isFinite(s) ||
                    s <= 0) {
                    return this._.alpha;
                }
                this._.alpha = s;
                return s;
            }
        };

        function Danmaku(opt) {
            opt && init$1.call(this, opt);
        }
        Danmaku.prototype.destroy = function () {
            return destroy.call(this);
        };
        Danmaku.prototype.emit = function (cmt) {
            return emit.call(this, cmt);
        };
        Danmaku.prototype.show = function () {
            return show.call(this);
        };
        Danmaku.prototype.hide = function () {
            return hide.call(this);
        };
        Danmaku.prototype.clear = function () {
            return clear$1.call(this);
        };
        Danmaku.prototype.resize = function () {
            return resize$1.call(this);
        };
        Object.defineProperty(Danmaku.prototype, 'speed', speed);
        Object.defineProperty(Danmaku.prototype, 'alpha', alpha);

        return Danmaku;

    })));
    //danmaku弹幕渲染库 结束


    // 配置
    // 使用代理绕过dandanplay对浏览器的CORS限制
    const apiProxy = 'https://video.acgfun.fun:888';
    const check_interval = 1000; //不用那么频繁检测
    const chConverTtitle = ['当前状态: 未启用', '当前状态: 转换为简体', '当前状态: 转换为繁体'];
    // 0:当前状态关闭 1:当前状态打开
    const danmaku_icons = ['\uE0B9', '\uE7A2'];
    const search_icon = '\uE881';
    const translate_icon = '\uE927';
    const info_icon = '\uE0E0';
    const filter_icons = ['\uE3E0', '\uE3D0', '\uE3D1', '\uE3D2'];
    const buttonOptions = {
        class: 'paper-icon-button-light',
        is: 'paper-icon-button-light',
    };
    const uiAnchorStr = '\uE034';
    const mediaContainerQueryStr = "div.htmlVideoPlayerContainer";
    const mediaQueryStr = 'video';
    const displayButtonOpts = {
        title: '弹幕开关',
        id: 'displayDanmaku',
        innerText: null,
        onclick: () => {
            if (window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('切换弹幕开关');
            window.ede.danmakuSwitch = (window.ede.danmakuSwitch + 1) % 2;
            window.localStorage.setItem('danmakuSwitch', window.ede.danmakuSwitch);
            document.querySelector('#displayDanmaku').children[0].innerText = danmaku_icons[window.ede.danmakuSwitch];
            if (window.ede.danmaku) {
                window.ede.danmakuSwitch == 1 ? window.ede.danmaku.show() : window.ede.danmaku.hide();
            }
        },
    };
    const searchButtonOpts = {
        title: '搜索弹幕',
        id: 'searchDanmaku',
        innerText: search_icon,
        onclick: () => {
            if (window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('手动匹配弹幕');
            reloadDanmaku('search');
        },
    };
    const translateButtonOpts = {
        title: null,
        id: 'translateDanmaku',
        innerText: translate_icon,
        onclick: () => {
            if (window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('切换简繁转换');
            window.ede.chConvert = (window.ede.chConvert + 1) % 3;
            window.localStorage.setItem('chConvert', window.ede.chConvert);
            document.querySelector('#translateDanmaku').setAttribute('title', chConverTtitle[window.ede.chConvert]);
            reloadDanmaku('reload');
            console.log(document.querySelector('#translateDanmaku').getAttribute('title'));
        },
    };
    const infoButtonOpts = {
        title: '弹幕信息',
        id: 'printDanmakuInfo',
        innerText: info_icon,
        onclick: () => {
            if (!window.ede.episode_info || window.ede.loading) {
                console.log('正在加载,请稍后再试');
                return;
            }
            console.log('显示当前信息');
            let msg = '动画名称:' + window.ede.episode_info.animeTitle;
            if (window.ede.episode_info.episodeTitle) {
                msg += '\n分集名称:' + window.ede.episode_info.episodeTitle;
            }
            sendNotification('当前弹幕匹配', msg);
        },
    };

    const filterButtonOpts = {
        title: '过滤等级(下次加载生效)',
        id: 'filteringDanmaku',
        innerText: null,
        onclick: () => {
            console.log('切换弹幕过滤等级');
            let level = window.localStorage.getItem('danmakuFilterLevel');
            level = ((level ? parseInt(level) : 0) + 1) % 4;
            window.localStorage.setItem('danmakuFilterLevel', level);
            document.querySelector('#filteringDanmaku').children[0].innerText = filter_icons[level];
        },
    };

    class EDE {
        constructor() {
            this.chConvert = 1;
            if (window.localStorage.getItem('chConvert')) {
                this.chConvert = window.localStorage.getItem('chConvert');
            }
            // 0:当前状态关闭 1:当前状态打开
            this.danmakuSwitch = 1;
            if (window.localStorage.getItem('danmakuSwitch')) {
                this.danmakuSwitch = parseInt(window.localStorage.getItem('danmakuSwitch'));
            }
            this.danmaku = null;
            this.episode_info = null;
            this.ob = null;
            this.loading = false;
        }
    }

    function createButton(opt) {
        let button = document.createElement('button', buttonOptions);
        button.setAttribute('title', opt.title);
        button.setAttribute('id', opt.id);
        let icon = document.createElement('span');
        icon.className = 'md-icon';
        icon.innerText = opt.innerText;
        button.appendChild(icon);
        button.onclick = opt.onclick;
        return button;
    }

    function initListener() {
        let container = document.querySelector(mediaQueryStr);
        // 页面未加载
        if (!container) {
            if (window.ede.episode_info) {
                window.ede.episode_info = null;
            }
            return;
        }
        if (!container.getAttribute('ede_listening')) {
            console.log('正在初始化Listener');
            container.setAttribute('ede_listening', true);
            container.addEventListener('play', reloadDanmaku);
            //暂停清除标志位
            container.addEventListener('pause', ()=>{container?.setAttribute('ede_listening', false);});
            console.log('Listener初始化完成');
            
            //已经在播放了,play不会触发,直接调用
            if (!container.paused) reloadDanmaku();
        }
    }

    function getElementsByInnerText(tagType, innerStr, excludeChildNode = true) {
        var temp = [];
        var elements = document.getElementsByTagName(tagType);
        if (!elements || 0 == elements.length) {
            return temp;
        }
        for (let index = 0; index < elements.length; index++) {
            var e = elements[index];
            if (e.innerText.includes(innerStr)) {
                temp.push(e);
            }
        }
        if (!excludeChildNode) {
            return temp;
        }
        var res = [];
        temp.forEach((e) => {
            var e_copy = e.cloneNode(true);
            while (e_copy.firstChild != e_copy.lastChild) {
                e_copy.removeChild(e_copy.lastChild);
            }
            if (e_copy.innerText.includes(innerStr)) {
                res.push(e);
            }
        });
        return res;
    }

    function initUI() {
        // 页面未加载
        let uiAnchor = getElementsByInnerText('i', uiAnchorStr);
        if (!uiAnchor || !uiAnchor[0]) {
            return;
        }
        // 已初始化
        if (document.getElementById('danmakuCtr')) {
            return;
        }
        console.log('正在初始化UI');
        // 弹幕按钮容器div
        let parent = uiAnchor[0].parentNode.parentNode.parentNode;
        let menubar = document.createElement('div');
        menubar.id = 'danmakuCtr';
        if (!window.ede.episode_info) {
            menubar.style.opacity = 0.5;
        }
        parent.append(menubar);
        // 弹幕开关
        displayButtonOpts.innerText = danmaku_icons[window.ede.danmakuSwitch];
        menubar.appendChild(createButton(displayButtonOpts));
        // 手动匹配
        menubar.appendChild(createButton(searchButtonOpts));
        // 简繁转换
        translateButtonOpts.title = chConverTtitle[window.ede.chConvert];
        menubar.appendChild(createButton(translateButtonOpts));
        // 屏蔽等级
        filterButtonOpts.innerText = filter_icons[parseInt(window.localStorage.getItem('danmakuFilterLevel') ? window.localStorage.getItem('danmakuFilterLevel') : 0)];
        menubar.appendChild(createButton(filterButtonOpts));
        // 弹幕信息
        menubar.appendChild(createButton(infoButtonOpts));
        console.log('UI初始化完成');
    }

    function sendNotification(title, msg) {
        const Notification = window.Notification || window.webkitNotifications;
        console.log(msg);
        if (Notification.permission === 'granted') {
            return new Notification(title, {
                body: msg,
            });
        } else {
            Notification.requestPermission((permission) => {
                if (permission === 'granted') {
                    return new Notification(title, {
                        body: msg,
                    });
                }
            });
        }
    }

    function getEmbyItemInfo() {
        return window.require(['pluginManager']).then((items) => {
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.pluginsList) {
                        for (let j = 0; j < item.pluginsList.length; j++) {
                            const plugin = item.pluginsList[j];
                            if (plugin && plugin.id == 'htmlvideoplayer') {
                                return plugin._currentPlayOptions ? plugin._currentPlayOptions.item : null;
                            }
                        }
                    }
                }
            }
            return null;
        });
    }

    async function getEpisodeInfo(is_auto = true) {
        let item = await getEmbyItemInfo();
        if (!item) {
            return null;
        }
        let _id;
        let animeName;
        let anime_id = -1;
        let episode;
        if (item.Type == 'Episode') {
            _id = item.SeasonId;
            animeName = item.SeriesName;
            episode = item.IndexNumber;
            let session = item.ParentIndexNumber;
            if (session != 1) {
                animeName += ' ' + session;
            }
        } else {
            _id = item.Id;
            animeName = item.Name;
            episode = 'movie';
        }
        let _id_key = '_anime_id_rel_' + _id;
        let _name_key = '_anime_name_rel_' + _id;
        let _episode_key = '_episode_id_rel_' + _id + '_' + episode;
        if (is_auto) {
            if (window.localStorage.getItem(_episode_key)) {
                return JSON.parse(window.localStorage.getItem(_episode_key));
            }
        }
        if (window.localStorage.getItem(_id_key)) {
            anime_id = window.localStorage.getItem(_id_key);
        }
        if (window.localStorage.getItem(_name_key)) {
            animeName = window.localStorage.getItem(_name_key);
        }
        if (!is_auto) {
            animeName = prompt('确认动画名:', animeName);
        }
        
        let searchUrl = apiProxy + '/api/v2/search/episodes?anime=' + animeName + '&withRelated=true';
        //不使用episode参数,在混合内容里找不到番剧
        //if (is_auto) {
        //    searchUrl += '&episode=' + episode;
        //}
        let animaInfo = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept-Encoding': 'gzip',
                Accept: 'application/json',
                'User-Agent': navigator.userAgent,
            },
        })
            .then((response) => response.json())
            .catch((error) => {
                console.log('查询失败:', error);
                return null;
            });
        console.log('查询成功');
        console.log(animaInfo);
        let selecAnime_id = 1;
        if (anime_id != -1) {
            for (let index = 0; index < animaInfo.animes.length; index++) {
                if (animaInfo.animes[index].animeId == anime_id) {
                    selecAnime_id = index + 1;
                }
            }
        }
        if (!is_auto) {
            let anime_lists_str = list2string(animaInfo);
            console.log(anime_lists_str);
            selecAnime_id = prompt('选择:\n' + anime_lists_str, selecAnime_id);
            selecAnime_id = parseInt(selecAnime_id) - 1;
            window.localStorage.setItem(_id_key, animaInfo.animes[selecAnime_id].animeId);
            window.localStorage.setItem(_name_key, animaInfo.animes[selecAnime_id].animeTitle);
            let episode_lists_str = ep2string(animaInfo.animes[selecAnime_id].episodes);
            episode = prompt('确认集数:\n' + episode_lists_str, episode === 'movie' ? 1 : parseInt(episode));
            episode = parseInt(episode) - 1;
        } else {
            selecAnime_id = parseInt(selecAnime_id) - 1;
            episode = episode === 'movie' ? 0 : parseInt(episode) - 1;
        }
        let episodeInfo = {
            episodeId: animaInfo.animes[selecAnime_id].episodes[episode].episodeId,
            animeTitle: animaInfo.animes[selecAnime_id].animeTitle,
            episodeTitle: animaInfo.animes[selecAnime_id].type == 'tvseries' ? animaInfo.animes[selecAnime_id].episodes[episode].episodeTitle : null,
        };
        window.localStorage.setItem(_episode_key, JSON.stringify(episodeInfo));
        return episodeInfo;
    }

    function getComments(episodeId) {
        let url = apiProxy+'/api/v2/comment/' + episodeId + '?withRelated=true&chConvert=' + window.ede.chConvert;
        return fetch(url, {
            method: 'GET',
            headers: {
                'Accept-Encoding': 'gzip',
                Accept: 'application/json',
                'User-Agent': navigator.userAgent,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('弹幕下载成功: ' + data.comments.length);
                return data.comments;
            })
            .catch((error) => {
                console.log('获取弹幕失败:', error);
                return null;
            });
    }

    async function createDanmaku(comments) {
        if (!comments) {
            return;
        }
        if (window.ede.danmaku != null) {
            window.ede.danmaku.clear();
            window.ede.danmaku.destroy();
            window.ede.danmaku = null;
        }
        let _comments = danmakuFilter(danmakuParser(comments));
        console.log('弹幕加载成功: ' + _comments.length);

        while (!document.querySelector(mediaContainerQueryStr)) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        let _container = document.querySelector(mediaContainerQueryStr);
        let _media = document.querySelector(mediaQueryStr);
        window.ede.danmaku = new Danmaku({
            container: _container,
            media: _media,
            comments: _comments,
            engine: 'canvas',
            alpha: 0.5
        });
        window.ede.danmakuSwitch == 1 ? window.ede.danmaku.show() : window.ede.danmaku.hide();

        if (window.ede.ob) {
            window.ede.ob.disconnect();
        }
        window.ede.ob = new ResizeObserver(() => {
            if (window.ede.danmaku) {
                console.log('Resizing');
                window.ede.danmaku.resize();
            }
        });
        window.ede.ob.observe(_container);
    }

    function reloadDanmaku(type = 'check') {
        if (window.ede.loading) {
            console.log('正在重新加载');
            return;
        }
        window.ede.loading = true;
        getEpisodeInfo(type != 'search')
            .then((info) => {
                return new Promise((resolve, reject) => {
                    if (!info) {
                        if (type != 'init') {
                            reject('播放器未完成加载');
                        } else {
                            reject(null);
                        }
                    }
                    if (type != 'search' && type != 'reload' && window.ede.danmaku && window.ede.episode_info && window.ede.episode_info.episodeId == info.episodeId) {
                        reject('当前播放视频未变动');
                    } else {
                        window.ede.episode_info = info;
                        resolve(info.episodeId);
                    }
                });
            })
            .then(
                (episodeId) =>
                    getComments(episodeId).then((comments) =>
                        createDanmaku(comments).then(() => {
                            console.log('弹幕就位');
                        }),
                    ),
                (msg) => {
                    if (msg) {
                        console.log(msg);
                    }
                },
            )
            .then(() => {
                window.ede.loading = false;
                if (document.getElementById('danmakuCtr').style.opacity != 1) {
                    document.getElementById('danmakuCtr').style.opacity = 1;
                }
            });
    }

    function danmakuFilter(comments) {
        let level = parseInt(window.localStorage.getItem('danmakuFilterLevel') ? window.localStorage.getItem('danmakuFilterLevel') : 0);
        if (level == 0) {
            return comments;
        }
        let limit = 9 - level * 2;
        let vertical_limit = 6;
        let arr_comments = [];
        let vertical_comments = [];
        for (let index = 0; index < comments.length; index++) {
            let element = comments[index];
            let i = Math.ceil(element.time);
            let i_v = Math.ceil(element.time / 3);
            if (!arr_comments[i]) {
                arr_comments[i] = [];
            }
            if (!vertical_comments[i_v]) {
                vertical_comments[i_v] = [];
            }
            // TODO: 屏蔽过滤
            if (vertical_comments[i_v].length < vertical_limit) {
                vertical_comments[i_v].push(element);
            } else {
                element.mode = 'rtl';
            }
            if (arr_comments[i].length < limit) {
                arr_comments[i].push(element);
            }
        }
        return arr_comments.flat();
    }

    function danmakuParser($obj) {
        //const $xml = new DOMParser().parseFromString(string, 'text/xml')
        return $obj
            .map(($comment) => {
                const p = $comment.p;
                //if (p === null || $comment.childNodes[0] === undefined) return null
                const values = p.split(',');
                const mode = { 6: 'ltr', 1: 'rtl', 5: 'top', 4: 'bottom' }[values[1]];
                if (!mode) return null;
                //const fontSize = Number(values[2]) || 25

                const fontSize = Math.round((window.screen.height > window.screen.width ? window.screen.width : window.screen.height) * window.devicePixelRatio / 1080 * 22);
                const color = `000000${Number(values[2]).toString(16)}`.slice(-6);
                return {
                    text: $comment.m,
                    mode,
                    time: values[0] * 1,
                    style: {
                        fontSize: `${fontSize}px`,
                        color: `#${color}`,
                        font: `${fontSize}px sans-serif`,
                        fillStyle: `#${color}`,
                        strokeStyle: '#000000',
                        lineWidth: 1.0,
                    },
                };
            })
            .filter((x) => x);
    }

    function list2string($obj2) {
        const $animes = $obj2.animes;
        let anime_lists = $animes.map(($single_anime) => {
            return $single_anime.animeTitle + ' 类型:' + $single_anime.typeDescription;
        });
        let anime_lists_str = '1:' + anime_lists[0];
        for (let i = 1; i < anime_lists.length; i++) {
            anime_lists_str = anime_lists_str + '\n' + (i + 1).toString() + ':' + anime_lists[i];
        }
        return anime_lists_str;
    }

    function ep2string($obj3) {
        const $animes = $obj3;
        let anime_lists = $animes.map(($single_ep) => {
            return $single_ep.episodeTitle;
        });
        let ep_lists_str = '1:' + anime_lists[0];
        for (let i = 1; i < anime_lists.length; i++) {
            ep_lists_str = ep_lists_str + '\n' + (i + 1).toString() + ':' + anime_lists[i];
        }
        return ep_lists_str;
    }

    while (!window.require) {
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!window.ede) {
        window.ede = new EDE();
        setInterval(() => {
            initUI();
        }, check_interval);
        while (!(await getEmbyItemInfo())) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        reloadDanmaku('init');
        setInterval(() => {
            initListener();
        }, check_interval);
    }
})();
