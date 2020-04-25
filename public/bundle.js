
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.WidgetTemplate = {}));
}(this, (function (exports) { 'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.21.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/widgets/Modal.svelte generated by Svelte v3.21.0 */
    const file = "src/widgets/Modal.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-4jb8o4-style";
    	style.textContent = ".modal-overlay.svelte-4jb8o4{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255, 255, 255, 0.75);z-index:10;display:flex;flex-direction:column;justify-content:center}.modal-container.svelte-4jb8o4{position:relative;background-color:#ffffff;width:50vw;margin:1rem auto 0.2rem;box-shadow:0 3px 10px #555}.close.svelte-4jb8o4{color:#aaa;cursor:pointer;position:absolute;top:0.5em;right:0;padding:0.8rem 0.5rem;transform:translate(0%, -50%);font-size:2rem;transition:all 200ms ease-in-out}main.svelte-4jb8o4{border:1rem;padding:1rem;border-radius:5px;box-shadow:0 4px 8px 0 rgba(0, 0, 0, 0.2),\n\t\t0 6px 20px 0 rgba(0, 0, 0, 0.19);text-align:center;display:flex;flex-flow:column}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTW9kYWwuc3ZlbHRlIiwic291cmNlcyI6WyJNb2RhbC5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgZmFkZSB9IGZyb20gXCJzdmVsdGUvdHJhbnNpdGlvblwiO1xuXG4gIGZ1bmN0aW9uIGhhbmRsZU92ZXJsYXlDbGljayhlKSB7XG4gICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY2xvc2UoXCJjbGlja2VkIG9uIHRoZSBiYWNrZ3JvdW5kXCIpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZUNsb3NlKGUpe1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjbG9zZShcImNsaWNrZWQgb24gdGhlICd4JyBidXR0b25cIikpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xvc2UocmVhc29uKSB7XG4gICAgc2hvdyA9IGZhbHNlO1xuICAgcmV0dXJuIG5ldyBDdXN0b21FdmVudCgnbWVzc2FnZScsIHtcblx0XHRcdGRldGFpbDogeyB0ZXh0OiBgTW9kYWwgJHtuYW1lfSB3YXMgY2xvc2VkIGJlY2F1c2UgeW91ICR7cmVhc29ufSFgIH0sXG5cdFx0XHRidWJibGVzOiB0cnVlLFxuXHRcdFx0Y2FuY2VsYWJsZTogdHJ1ZSxcblx0XHRcdGNvbXBvc2VkOiB0cnVlLFxuXHRcdH0pO1xuXG4gIH1cblxuICBleHBvcnQgbGV0IG5hbWUgPSBcIlVua25vd25cIjtcblxuICBleHBvcnQgbGV0IHNob3cgPSBmYWxzZTtcbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4gLm1vZGFsLW92ZXJsYXkge1xuICAgcG9zaXRpb246IGZpeGVkO1xuICAgdG9wOiAwO1xuICAgbGVmdDogMDtcbiAgIHJpZ2h0OiAwO1xuICAgYm90dG9tOiAwO1xuICAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjc1KTtcbiAgIHotaW5kZXg6IDEwO1xuICAgZGlzcGxheTogZmxleDtcbiAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiB9XG4gLm1vZGFsLWNvbnRhaW5lciB7XG4gICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICBiYWNrZ3JvdW5kLWNvbG9yOiAjZmZmZmZmO1xuICAgd2lkdGg6IDUwdnc7XG4gICBtYXJnaW46IDFyZW0gYXV0byAwLjJyZW07XG4gICBib3gtc2hhZG93OiAwIDNweCAxMHB4ICM1NTU7XG4gfVxuIC5jbG9zZSB7XG5cdGNvbG9yOiAjYWFhO1xuXHRjdXJzb3I6IHBvaW50ZXI7XG5cdHBvc2l0aW9uOiBhYnNvbHV0ZTtcblx0dG9wOiAwLjVlbTtcblx0cmlnaHQ6IDA7XG5cdHBhZGRpbmc6IDAuOHJlbSAwLjVyZW07XG5cdHRyYW5zZm9ybTogdHJhbnNsYXRlKDAlLCAtNTAlKTtcblx0Zm9udC1zaXplOiAycmVtO1xuXHR0cmFuc2l0aW9uOiBhbGwgMjAwbXMgZWFzZS1pbi1vdXQ7XG59XG5cbiBtYWluIHtcblx0Ym9yZGVyOiAxcmVtO1xuXHRwYWRkaW5nOiAxcmVtO1xuXHRib3JkZXItcmFkaXVzOiA1cHg7XG5cdGJveC1zaGFkb3c6IDAgNHB4IDhweCAwIHJnYmEoMCwgMCwgMCwgMC4yKSxcblx0XHQwIDZweCAyMHB4IDAgcmdiYSgwLCAwLCAwLCAwLjE5KTtcblx0dGV4dC1hbGlnbjogY2VudGVyO1xuXHRkaXNwbGF5OiBmbGV4O1xuXHRmbGV4LWZsb3c6IGNvbHVtbjtcbn1cblxuLyojIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTkzYVdSblpYUnpMMDF2WkdGc0xuTjJaV3gwWlNKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pTzBOQlEwTTdSMEZEUlN4bFFVRmxPMGRCUTJZc1RVRkJUVHRIUVVOT0xFOUJRVTg3UjBGRFVDeFJRVUZSTzBkQlExSXNVMEZCVXp0SFFVTlVMSEZEUVVGeFF6dEhRVU55UXl4WFFVRlhPMGRCUTFnc1lVRkJZVHRIUVVOaUxITkNRVUZ6UWp0SFFVTjBRaXgxUWtGQmRVSTdRMEZEZWtJN1EwRkRRVHRIUVVORkxHdENRVUZyUWp0SFFVTnNRaXg1UWtGQmVVSTdSMEZEZWtJc1YwRkJWenRIUVVOWUxIZENRVUYzUWp0SFFVTjRRaXd5UWtGQk1rSTdRMEZETjBJN1EwRkRRVHREUVVOQkxGZEJRVmM3UTBGRFdDeGxRVUZsTzBOQlEyWXNhMEpCUVd0Q08wTkJRMnhDTEZWQlFWVTdRMEZEVml4UlFVRlJPME5CUTFJc2MwSkJRWE5DTzBOQlEzUkNMRGhDUVVFNFFqdERRVU01UWl4bFFVRmxPME5CUTJZc2FVTkJRV2xETzBGQlEyeERPenREUVVWRE8wTkJRMEVzV1VGQldUdERRVU5hTEdGQlFXRTdRMEZEWWl4clFrRkJhMEk3UTBGRGJFSTdhME5CUTJsRE8wTkJRMnBETEd0Q1FVRnJRanREUVVOc1FpeGhRVUZoTzBOQlEySXNhVUpCUVdsQ08wRkJRMnhDSWl3aVptbHNaU0k2SW5OeVl5OTNhV1JuWlhSekwwMXZaR0ZzTG5OMlpXeDBaU0lzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWx4dUlDNXRiMlJoYkMxdmRtVnliR0Y1SUh0Y2JpQWdJSEJ2YzJsMGFXOXVPaUJtYVhobFpEdGNiaUFnSUhSdmNEb2dNRHRjYmlBZ0lHeGxablE2SURBN1hHNGdJQ0J5YVdkb2REb2dNRHRjYmlBZ0lHSnZkSFJ2YlRvZ01EdGNiaUFnSUdKaFkydG5jbTkxYm1RNklISm5ZbUVvTWpVMUxDQXlOVFVzSURJMU5Td2dNQzQzTlNrN1hHNGdJQ0I2TFdsdVpHVjRPaUF4TUR0Y2JpQWdJR1JwYzNCc1lYazZJR1pzWlhnN1hHNGdJQ0JtYkdWNExXUnBjbVZqZEdsdmJqb2dZMjlzZFcxdU8xeHVJQ0FnYW5WemRHbG1lUzFqYjI1MFpXNTBPaUJqWlc1MFpYSTdYRzRnZlZ4dUlDNXRiMlJoYkMxamIyNTBZV2x1WlhJZ2UxeHVJQ0FnY0c5emFYUnBiMjQ2SUhKbGJHRjBhWFpsTzF4dUlDQWdZbUZqYTJkeWIzVnVaQzFqYjJ4dmNqb2dJMlptWm1abVpqdGNiaUFnSUhkcFpIUm9PaUExTUhaM08xeHVJQ0FnYldGeVoybHVPaUF4Y21WdElHRjFkRzhnTUM0eWNtVnRPMXh1SUNBZ1ltOTRMWE5vWVdSdmR6b2dNQ0F6Y0hnZ01UQndlQ0FqTlRVMU8xeHVJSDFjYmlBdVkyeHZjMlVnZTF4dVhIUmpiMnh2Y2pvZ0kyRmhZVHRjYmx4MFkzVnljMjl5T2lCd2IybHVkR1Z5TzF4dVhIUndiM05wZEdsdmJqb2dZV0p6YjJ4MWRHVTdYRzVjZEhSdmNEb2dNQzQxWlcwN1hHNWNkSEpwWjJoME9pQXdPMXh1WEhSd1lXUmthVzVuT2lBd0xqaHlaVzBnTUM0MWNtVnRPMXh1WEhSMGNtRnVjMlp2Y20wNklIUnlZVzV6YkdGMFpTZ3dKU3dnTFRVd0pTazdYRzVjZEdadmJuUXRjMmw2WlRvZ01uSmxiVHRjYmx4MGRISmhibk5wZEdsdmJqb2dZV3hzSURJd01HMXpJR1ZoYzJVdGFXNHRiM1YwTzF4dWZWeHVYRzRnYldGcGJpQjdYRzVjZEdKdmNtUmxjam9nTVhKbGJUdGNibHgwY0dGa1pHbHVaem9nTVhKbGJUdGNibHgwWW05eVpHVnlMWEpoWkdsMWN6b2dOWEI0TzF4dVhIUmliM2d0YzJoaFpHOTNPaUF3SURSd2VDQTRjSGdnTUNCeVoySmhLREFzSURBc0lEQXNJREF1TWlrc1hHNWNkRngwTUNBMmNIZ2dNakJ3ZUNBd0lISm5ZbUVvTUN3Z01Dd2dNQ3dnTUM0eE9TazdYRzVjZEhSbGVIUXRZV3hwWjI0NklHTmxiblJsY2p0Y2JseDBaR2x6Y0d4aGVUb2dabXhsZUR0Y2JseDBabXhsZUMxbWJHOTNPaUJqYjJ4MWJXNDdYRzU5WEc0aVhYMD0gKi88L3N0eWxlPlxuXG57I2lmIHNob3d9XG4gIDxkaXY+XG4gICAgPGRpdlxuICAgICAgY2xhc3M9XCJtb2RhbC1vdmVybGF5XCJcbiAgICAgIG9uOmNsaWNrPXtoYW5kbGVPdmVybGF5Q2xpY2t9XG4gICAgICB0cmFuc2l0aW9uOmZhZGU9e3sgZHVyYXRpb246IDIwMCB9fT5cbiAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1jb250YWluZXJcIj5cbiAgICAgIDxzcGFuIGNsYXNzPVwiY2xvc2VcIiBvbjpjbGljaz17aGFuZGxlQ2xvc2V9PiZ0aW1lczs8L3NwYW4+XG4gICAgICAgIDxtYWluPlxuICAgICAgICAgIDxwPkhlbGxvIHtuYW1lfTwvcD5cbiAgICAgICAgPC9tYWluPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2Plxuey9pZn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE0QkMsY0FBYyxjQUFDLENBQUMsQUFDZCxRQUFRLENBQUUsS0FBSyxDQUNmLEdBQUcsQ0FBRSxDQUFDLENBQ04sSUFBSSxDQUFFLENBQUMsQ0FDUCxLQUFLLENBQUUsQ0FBQyxDQUNSLE1BQU0sQ0FBRSxDQUFDLENBQ1QsVUFBVSxDQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQ3JDLE9BQU8sQ0FBRSxFQUFFLENBQ1gsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxDQUN0QixlQUFlLENBQUUsTUFBTSxBQUN6QixDQUFDLEFBQ0QsZ0JBQWdCLGNBQUMsQ0FBQyxBQUNoQixRQUFRLENBQUUsUUFBUSxDQUNsQixnQkFBZ0IsQ0FBRSxPQUFPLENBQ3pCLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUN4QixVQUFVLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxBQUM3QixDQUFDLEFBQ0QsTUFBTSxjQUFDLENBQUMsQUFDUixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxPQUFPLENBQ2YsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsR0FBRyxDQUFFLEtBQUssQ0FDVixLQUFLLENBQUUsQ0FBQyxDQUNSLE9BQU8sQ0FBRSxNQUFNLENBQUMsTUFBTSxDQUN0QixTQUFTLENBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FDOUIsU0FBUyxDQUFFLElBQUksQ0FDZixVQUFVLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLEFBQ2xDLENBQUMsQUFFQSxJQUFJLGNBQUMsQ0FBQyxBQUNOLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDMUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQ2pDLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsU0FBUyxDQUFFLE1BQU0sQUFDbEIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    // (73:0) {#if show}
    function create_if_block(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let span;
    	let t1;
    	let main;
    	let p;
    	let t2;
    	let t3;
    	let div1_transition;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "×";
    			t1 = space();
    			main = element("main");
    			p = element("p");
    			t2 = text("Hello ");
    			t3 = text(/*name*/ ctx[1]);
    			attr_dev(span, "class", "close svelte-4jb8o4");
    			add_location(span, file, 79, 6, 3394);
    			add_location(p, file, 81, 10, 3477);
    			attr_dev(main, "class", "svelte-4jb8o4");
    			add_location(main, file, 80, 8, 3460);
    			attr_dev(div0, "class", "modal-container svelte-4jb8o4");
    			add_location(div0, file, 78, 6, 3358);
    			attr_dev(div1, "class", "modal-overlay svelte-4jb8o4");
    			add_location(div1, file, 74, 4, 3240);
    			add_location(div2, file, 73, 2, 3230);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, span);
    			append_dev(div0, t1);
    			append_dev(div0, main);
    			append_dev(main, p);
    			append_dev(p, t2);
    			append_dev(p, t3);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(span, "click", /*handleClose*/ ctx[3], false, false, false),
    				listen_dev(div1, "click", /*handleOverlayClick*/ ctx[2], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*name*/ 2) set_data_dev(t3, /*name*/ ctx[1]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 200 }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 200 }, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (detaching && div1_transition) div1_transition.end();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(73:0) {#if show}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*show*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*show*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*show*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	function handleOverlayClick(e) {
    		this.dispatchEvent(close("clicked on the background"));
    	}

    	function handleClose(e) {
    		this.dispatchEvent(close("clicked on the 'x' button"));
    	}

    	function close(reason) {
    		$$invalidate(0, show = false);

    		return new CustomEvent("message",
    		{
    				detail: {
    					text: `Modal ${name} was closed because you ${reason}!`
    				},
    				bubbles: true,
    				cancelable: true,
    				composed: true
    			});
    	}

    	let { name = "Unknown" } = $$props;
    	let { show = false } = $$props;
    	const writable_props = ["name", "show"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Modal", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("show" in $$props) $$invalidate(0, show = $$props.show);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		handleOverlayClick,
    		handleClose,
    		close,
    		name,
    		show
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("show" in $$props) $$invalidate(0, show = $$props.show);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [show, name, handleOverlayClick, handleClose];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-4jb8o4-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 1, show: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get show() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set show(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Main.svelte generated by Svelte v3.21.0 */
    const file$1 = "src/Main.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-180w7rw-style";
    	style.textContent = ".main.svelte-180w7rw{border:1rem;padding:1rem;border-radius:5px;box-shadow:0 4px 8px 0 rgba(0, 0, 0, 0.2),\n\t\t0 6px 20px 0 rgba(0, 0, 0, 0.19);text-align:center;display:flex;flex-flow:column}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWFpbi5zdmVsdGUiLCJzb3VyY2VzIjpbIk1haW4uc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG5cdGltcG9ydCBNb2RhbCBmcm9tICcuL3dpZGdldHMvTW9kYWwuc3ZlbHRlJztcblxuXHRsZXQgbW9kYWxfc2hvdyA9IGZhbHNlO1xuXG5cdGZ1bmN0aW9uIG9wZW5TaWRlYmFyKCkge1xuXHRcdFxuXHRcdHRoaXMuZGlzcGF0Y2hFdmVudChcblx0XHRcdG5ldyBDdXN0b21FdmVudCgnb3BlblNpZGViYXInLCB7XG5cdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdGNhbmNlbGFibGU6IHRydWUsXG5cdFx0XHRcdGNvbXBvc2VkOiB0cnVlLFxuXHRcdFx0fSlcblx0XHQpO1xuXHR9XG48L3NjcmlwdD5cblxuPHN0eWxlPlxuLm1haW4ge1xuXHRib3JkZXI6IDFyZW07XG5cdHBhZGRpbmc6IDFyZW07XG5cdGJvcmRlci1yYWRpdXM6IDVweDtcblx0Ym94LXNoYWRvdzogMCA0cHggOHB4IDAgcmdiYSgwLCAwLCAwLCAwLjIpLFxuXHRcdDAgNnB4IDIwcHggMCByZ2JhKDAsIDAsIDAsIDAuMTkpO1xuXHR0ZXh0LWFsaWduOiBjZW50ZXI7XG5cdGRpc3BsYXk6IGZsZXg7XG5cdGZsZXgtZmxvdzogY29sdW1uO1xufVxuXG4vKiMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OU5ZV2x1TG5OMlpXeDBaU0pkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUTBFN1EwRkRReXhaUVVGWk8wTkJRMW9zWVVGQllUdERRVU5pTEd0Q1FVRnJRanREUVVOc1FqdHJRMEZEYVVNN1EwRkRha01zYTBKQlFXdENPME5CUTJ4Q0xHRkJRV0U3UTBGRFlpeHBRa0ZCYVVJN1FVRkRiRUlpTENKbWFXeGxJam9pYzNKakwwMWhhVzR1YzNabGJIUmxJaXdpYzI5MWNtTmxjME52Ym5SbGJuUWlPbHNpWEc0dWJXRnBiaUI3WEc1Y2RHSnZjbVJsY2pvZ01YSmxiVHRjYmx4MGNHRmtaR2x1WnpvZ01YSmxiVHRjYmx4MFltOXlaR1Z5TFhKaFpHbDFjem9nTlhCNE8xeHVYSFJpYjNndGMyaGhaRzkzT2lBd0lEUndlQ0E0Y0hnZ01DQnlaMkpoS0RBc0lEQXNJREFzSURBdU1pa3NYRzVjZEZ4ME1DQTJjSGdnTWpCd2VDQXdJSEpuWW1Fb01Dd2dNQ3dnTUN3Z01DNHhPU2s3WEc1Y2RIUmxlSFF0WVd4cFoyNDZJR05sYm5SbGNqdGNibHgwWkdsemNHeGhlVG9nWm14bGVEdGNibHgwWm14bGVDMW1iRzkzT2lCamIyeDFiVzQ3WEc1OVhHNGlYWDA9ICovPC9zdHlsZT5cblxuPGRpdiBjbGFzcz1cIm1haW5cIj5cblx0PGgzPlRoaXMgaXMgdGhlICdNYWluLnN2ZWx0ZScgd2lkZ2V0PC9oMz5cblx0PGJ1dHRvbiBvbjpjbGljaz17KCkgPT4gKG1vZGFsX3Nob3cgPSAhbW9kYWxfc2hvdyl9PlRvZ2dsZSBNb2RhbDwvYnV0dG9uPlxuXG5cdDxidXR0b24gb246Y2xpY2s9e29wZW5TaWRlYmFyfT5PcGVuIFNpZGViYXIgKGV2ZW50KTwvYnV0dG9uPlxuPC9kaXY+XG48TW9kYWwgYmluZDpzaG93PXttb2RhbF9zaG93fSBuYW1lPVwiZnJvbSB0aGUgJ01haW4uc3ZlbHRlJyB3aWRnZXRcIiAvPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWtCQSxLQUFLLGVBQUMsQ0FBQyxBQUNOLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLElBQUksQ0FDYixhQUFhLENBQUUsR0FBRyxDQUNsQixVQUFVLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDMUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQ2pDLFVBQVUsQ0FBRSxNQUFNLENBQ2xCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsU0FBUyxDQUFFLE1BQU0sQUFDbEIsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function create_fragment$1(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let updating_show;
    	let current;
    	let dispose;

    	function modal_show_binding(value) {
    		/*modal_show_binding*/ ctx[2].call(null, value);
    	}

    	let modal_props = { name: "from the 'Main.svelte' widget" };

    	if (/*modal_show*/ ctx[0] !== void 0) {
    		modal_props.show = /*modal_show*/ ctx[0];
    	}

    	const modal = new Modal({ props: modal_props, $$inline: true });
    	binding_callbacks.push(() => bind(modal, "show", modal_show_binding));

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "This is the 'Main.svelte' widget";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "Toggle Modal";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Open Sidebar (event)";
    			t5 = space();
    			create_component(modal.$$.fragment);
    			add_location(h3, file$1, 32, 1, 1118);
    			add_location(button0, file$1, 33, 1, 1161);
    			add_location(button1, file$1, 35, 1, 1237);
    			attr_dev(div, "class", "main svelte-180w7rw");
    			add_location(div, file$1, 31, 0, 1098);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, button0);
    			append_dev(div, t3);
    			append_dev(div, button1);
    			insert_dev(target, t5, anchor);
    			mount_component(modal, target, anchor);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*click_handler*/ ctx[1], false, false, false),
    				listen_dev(button1, "click", openSidebar, false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			const modal_changes = {};

    			if (!updating_show && dirty & /*modal_show*/ 1) {
    				updating_show = true;
    				modal_changes.show = /*modal_show*/ ctx[0];
    				add_flush_callback(() => updating_show = false);
    			}

    			modal.$set(modal_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t5);
    			destroy_component(modal, detaching);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function openSidebar() {
    	this.dispatchEvent(new CustomEvent("openSidebar",
    	{
    			bubbles: true,
    			cancelable: true,
    			composed: true
    		}));
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let modal_show = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Main> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Main", $$slots, []);
    	const click_handler = () => $$invalidate(0, modal_show = !modal_show);

    	function modal_show_binding(value) {
    		modal_show = value;
    		$$invalidate(0, modal_show);
    	}

    	$$self.$capture_state = () => ({ Modal, modal_show, openSidebar });

    	$$self.$inject_state = $$props => {
    		if ("modal_show" in $$props) $$invalidate(0, modal_show = $$props.modal_show);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [modal_show, click_handler, modal_show_binding];
    }

    class Main extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-180w7rw-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Main",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/widgets/Sidebar.svelte generated by Svelte v3.21.0 */

    const { console: console_1 } = globals;
    const file$2 = "src/widgets/Sidebar.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-nul1z9-style";
    	style.textContent = "nav.svelte-nul1z9{position:fixed;top:0;left:0;height:100%;padding:3rem 2rem;border-right:1px solid #aaa;background:#fff;overflow-y:auto;width:30rem}.close.svelte-nul1z9{color:#aaa;cursor:pointer;position:absolute;top:0.5em;right:0;padding:0.8rem 0.5rem;transform:translate(0%, -50%);font-size:2rem;transition:all 200ms ease-in-out}.close.svelte-nul1z9:hover{color:#000}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2lkZWJhci5zdmVsdGUiLCJzb3VyY2VzIjpbIlNpZGViYXIuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQ+XG5cdGltcG9ydCB7IGZseSB9IGZyb20gJ3N2ZWx0ZS90cmFuc2l0aW9uJztcblx0aW1wb3J0IE1vZGFsIGZyb20gJy4vTW9kYWwuc3ZlbHRlJztcblxuXHRleHBvcnQgbGV0IHNob3cgPSBmYWxzZTtcblx0bGV0IG1vZGFsX3Nob3cgPSBmYWxzZTtcblxuXHRmdW5jdGlvbiBpbnRlcmNlcHRFdmVudChldmVudCkge1xuXHRcdGNvbnNvbGUubG9nKCdoZXJlJyk7XG5cdFx0Y29uc3QgbmV3RXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ21lc3NhZ2UnLCB7XG5cdFx0XHRkZXRhaWw6IHsgdGV4dDogJ1RoZSBzaWRlYmFyIG5vdGljZWQgdGhlIG1vZGFsIHdhcyBjbG9zZWQhJyB9LFxuXHRcdFx0YnViYmxlczogdHJ1ZSxcblx0XHRcdGNhbmNlbGFibGU6IHRydWUsXG5cdFx0XHRjb21wb3NlZDogdHJ1ZSxcblx0XHR9KTtcblxuXHRcdHRoaXMuZGlzcGF0Y2hFdmVudChuZXdFdmVudCk7XG5cdH1cblxuXHRmdW5jdGlvbiBjbG9zZSgpIHtcblx0XHRzaG93ID0gZmFsc2U7XG5cdH1cbjwvc2NyaXB0PlxuXG48c3R5bGU+XG5uYXYge1xuXHRwb3NpdGlvbjogZml4ZWQ7XG5cdHRvcDogMDtcblx0bGVmdDogMDtcblx0aGVpZ2h0OiAxMDAlO1xuXHRwYWRkaW5nOiAzcmVtIDJyZW07XG5cdGJvcmRlci1yaWdodDogMXB4IHNvbGlkICNhYWE7XG5cdGJhY2tncm91bmQ6ICNmZmY7XG5cdG92ZXJmbG93LXk6IGF1dG87XG5cdHdpZHRoOiAzMHJlbTtcbn1cblxuLmNsb3NlIHtcblx0Y29sb3I6ICNhYWE7XG5cdGN1cnNvcjogcG9pbnRlcjtcblx0cG9zaXRpb246IGFic29sdXRlO1xuXHR0b3A6IDAuNWVtO1xuXHRyaWdodDogMDtcblx0cGFkZGluZzogMC44cmVtIDAuNXJlbTtcblx0dHJhbnNmb3JtOiB0cmFuc2xhdGUoMCUsIC01MCUpO1xuXHRmb250LXNpemU6IDJyZW07XG5cdHRyYW5zaXRpb246IGFsbCAyMDBtcyBlYXNlLWluLW91dDtcbn1cblxuLmNsb3NlOmhvdmVyIHtcblx0Y29sb3I6ICMwMDA7XG59XG5cbi8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5M2FXUm5aWFJ6TDFOcFpHVmlZWEl1YzNabGJIUmxJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZEUVR0RFFVTkRMR1ZCUVdVN1EwRkRaaXhOUVVGTk8wTkJRMDRzVDBGQlR6dERRVU5RTEZsQlFWazdRMEZEV2l4clFrRkJhMEk3UTBGRGJFSXNORUpCUVRSQ08wTkJRelZDTEdkQ1FVRm5RanREUVVOb1FpeG5Ra0ZCWjBJN1EwRkRhRUlzV1VGQldUdEJRVU5pT3p0QlFVVkJPME5CUTBNc1YwRkJWenREUVVOWUxHVkJRV1U3UTBGRFppeHJRa0ZCYTBJN1EwRkRiRUlzVlVGQlZUdERRVU5XTEZGQlFWRTdRMEZEVWl4elFrRkJjMEk3UTBGRGRFSXNPRUpCUVRoQ08wTkJRemxDTEdWQlFXVTdRMEZEWml4cFEwRkJhVU03UVVGRGJFTTdPMEZCUlVFN1EwRkRReXhYUVVGWE8wRkJRMW9pTENKbWFXeGxJam9pYzNKakwzZHBaR2RsZEhNdlUybGtaV0poY2k1emRtVnNkR1VpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lKY2JtNWhkaUI3WEc1Y2RIQnZjMmwwYVc5dU9pQm1hWGhsWkR0Y2JseDBkRzl3T2lBd08xeHVYSFJzWldaME9pQXdPMXh1WEhSb1pXbG5hSFE2SURFd01DVTdYRzVjZEhCaFpHUnBibWM2SUROeVpXMGdNbkpsYlR0Y2JseDBZbTl5WkdWeUxYSnBaMmgwT2lBeGNIZ2djMjlzYVdRZ0kyRmhZVHRjYmx4MFltRmphMmR5YjNWdVpEb2dJMlptWmp0Y2JseDBiM1psY21ac2IzY3RlVG9nWVhWMGJ6dGNibHgwZDJsa2RHZzZJRE13Y21WdE8xeHVmVnh1WEc0dVkyeHZjMlVnZTF4dVhIUmpiMnh2Y2pvZ0kyRmhZVHRjYmx4MFkzVnljMjl5T2lCd2IybHVkR1Z5TzF4dVhIUndiM05wZEdsdmJqb2dZV0p6YjJ4MWRHVTdYRzVjZEhSdmNEb2dNQzQxWlcwN1hHNWNkSEpwWjJoME9pQXdPMXh1WEhSd1lXUmthVzVuT2lBd0xqaHlaVzBnTUM0MWNtVnRPMXh1WEhSMGNtRnVjMlp2Y20wNklIUnlZVzV6YkdGMFpTZ3dKU3dnTFRVd0pTazdYRzVjZEdadmJuUXRjMmw2WlRvZ01uSmxiVHRjYmx4MGRISmhibk5wZEdsdmJqb2dZV3hzSURJd01HMXpJR1ZoYzJVdGFXNHRiM1YwTzF4dWZWeHVYRzR1WTJ4dmMyVTZhRzkyWlhJZ2UxeHVYSFJqYjJ4dmNqb2dJekF3TUR0Y2JuMWNiaUpkZlE9PSAqLzwvc3R5bGU+XG5cbjwhLS0gQWxsb3cgdGhlIGV4cG9ydGVkIHByb3BzIHRvIGJlIHNldCBleHRlcm5hbGx5IC0tPlxuPHN2ZWx0ZTpvcHRpb25zIGFjY2Vzc29ycyAvPlxueyNpZiBzaG93fVxuXHQ8bmF2IHRyYW5zaXRpb246Zmx5PXt7IHg6IC0yNTAsIG9wYWNpdHk6IDEgfX0+XG5cdFx0PHNwYW4gY2xhc3M9XCJjbG9zZVwiIG9uOmNsaWNrPXtjbG9zZX0+JnRpbWVzOzwvc3Bhbj5cblx0XHQ8aDM+VGhpcyBpcyB0aGUgU2lkZWJhciB3aWRnZXQ8L2gzPlxuICAgIDxoci8+XG5cdFx0PGJ1dHRvblxuXHRcdFx0b246Y2xpY2s9eygpID0+IHtcblx0XHRcdFx0bW9kYWxfc2hvdyA9IHRydWU7XG5cdFx0XHR9fT5cblx0XHRcdFRvZ2dsZSBNb2RhbFxuXHRcdDwvYnV0dG9uPlxuXG5cdDwvbmF2Plxuey9pZn1cblxuPE1vZGFsIGJpbmQ6c2hvdz17bW9kYWxfc2hvd30gbmFtZT1cImZyb20gdGhlIHNpZGViYXIgd2lkZ2V0XCIgLz5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUF5QkEsR0FBRyxjQUFDLENBQUMsQUFDSixRQUFRLENBQUUsS0FBSyxDQUNmLEdBQUcsQ0FBRSxDQUFDLENBQ04sSUFBSSxDQUFFLENBQUMsQ0FDUCxNQUFNLENBQUUsSUFBSSxDQUNaLE9BQU8sQ0FBRSxJQUFJLENBQUMsSUFBSSxDQUNsQixZQUFZLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQzVCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLEtBQUssQ0FBRSxLQUFLLEFBQ2IsQ0FBQyxBQUVELE1BQU0sY0FBQyxDQUFDLEFBQ1AsS0FBSyxDQUFFLElBQUksQ0FDWCxNQUFNLENBQUUsT0FBTyxDQUNmLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxLQUFLLENBQ1YsS0FBSyxDQUFFLENBQUMsQ0FDUixPQUFPLENBQUUsTUFBTSxDQUFDLE1BQU0sQ0FDdEIsU0FBUyxDQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQzlCLFNBQVMsQ0FBRSxJQUFJLENBQ2YsVUFBVSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxBQUNsQyxDQUFDLEFBRUQsb0JBQU0sTUFBTSxBQUFDLENBQUMsQUFDYixLQUFLLENBQUUsSUFBSSxBQUNaLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    // (58:0) {#if show}
    function create_if_block$1(ctx) {
    	let nav;
    	let span;
    	let t1;
    	let h3;
    	let t3;
    	let hr;
    	let t4;
    	let button;
    	let nav_transition;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			span = element("span");
    			span.textContent = "×";
    			t1 = space();
    			h3 = element("h3");
    			h3.textContent = "This is the Sidebar widget";
    			t3 = space();
    			hr = element("hr");
    			t4 = space();
    			button = element("button");
    			button.textContent = "Toggle Modal";
    			attr_dev(span, "class", "close svelte-nul1z9");
    			add_location(span, file$2, 59, 2, 2186);
    			add_location(h3, file$2, 60, 2, 2240);
    			add_location(hr, file$2, 61, 4, 2280);
    			add_location(button, file$2, 62, 2, 2288);
    			attr_dev(nav, "class", "svelte-nul1z9");
    			add_location(nav, file$2, 58, 1, 2137);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, span);
    			append_dev(nav, t1);
    			append_dev(nav, h3);
    			append_dev(nav, t3);
    			append_dev(nav, hr);
    			append_dev(nav, t4);
    			append_dev(nav, button);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(span, "click", /*close*/ ctx[2], false, false, false),
    				listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false)
    			];
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!nav_transition) nav_transition = create_bidirectional_transition(nav, fly, { x: -250, opacity: 1 }, true);
    				nav_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!nav_transition) nav_transition = create_bidirectional_transition(nav, fly, { x: -250, opacity: 1 }, false);
    			nav_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching && nav_transition) nav_transition.end();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(58:0) {#if show}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let t;
    	let updating_show;
    	let current;
    	let if_block = /*show*/ ctx[0] && create_if_block$1(ctx);

    	function modal_show_binding(value) {
    		/*modal_show_binding*/ ctx[4].call(null, value);
    	}

    	let modal_props = { name: "from the sidebar widget" };

    	if (/*modal_show*/ ctx[1] !== void 0) {
    		modal_props.show = /*modal_show*/ ctx[1];
    	}

    	const modal = new Modal({ props: modal_props, $$inline: true });
    	binding_callbacks.push(() => bind(modal, "show", modal_show_binding));

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();
    			create_component(modal.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(modal, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*show*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*show*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const modal_changes = {};

    			if (!updating_show && dirty & /*modal_show*/ 2) {
    				updating_show = true;
    				modal_changes.show = /*modal_show*/ ctx[1];
    				add_flush_callback(() => updating_show = false);
    			}

    			modal.$set(modal_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(modal, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function interceptEvent(event) {
    	console.log("here");

    	const newEvent = new CustomEvent("message",
    	{
    			detail: {
    				text: "The sidebar noticed the modal was closed!"
    			},
    			bubbles: true,
    			cancelable: true,
    			composed: true
    		});

    	this.dispatchEvent(newEvent);
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { show = false } = $$props;
    	let modal_show = false;

    	function close() {
    		$$invalidate(0, show = false);
    	}

    	const writable_props = ["show"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Sidebar", $$slots, []);

    	const click_handler = () => {
    		$$invalidate(1, modal_show = true);
    	};

    	function modal_show_binding(value) {
    		modal_show = value;
    		$$invalidate(1, modal_show);
    	}

    	$$self.$set = $$props => {
    		if ("show" in $$props) $$invalidate(0, show = $$props.show);
    	};

    	$$self.$capture_state = () => ({
    		fly,
    		Modal,
    		show,
    		modal_show,
    		interceptEvent,
    		close
    	});

    	$$self.$inject_state = $$props => {
    		if ("show" in $$props) $$invalidate(0, show = $$props.show);
    		if ("modal_show" in $$props) $$invalidate(1, modal_show = $$props.modal_show);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [show, modal_show, close, click_handler, modal_show_binding];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-nul1z9-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { show: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get show() {
    		return this.$$.ctx[0];
    	}

    	set show(show) {
    		this.$set({ show });
    		flush();
    	}
    }

    exports.Main = Main;
    exports.Sidebar = Sidebar;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=bundle.js.map
