import ValueHolder from "./ValueHolder.js";

export class Component extends HTMLElement {
    // Render modes
    static NO_SHADOW = Symbol('no-shadow');

    static TODO = [
        'value bindings for create_template',
    ]

    constructor (property_values) {
        super();

        if ( this.constructor.RENDER_MODE === Component.NO_SHADOW ) {
            this.dom_ = this;
        } else {
            this.dom_ = this.attachShadow({ mode: 'open' });
        }

        this.values_ = {};

        if ( this.constructor.template ) {
            const template = document.querySelector(this.constructor.template);
            this.dom_.appendChild(template.content.cloneNode(true));
        }

        for ( const key in this.constructor.PROPERTIES ) {
            let initial_value;
            if ( property_values && key in property_values ) {
                initial_value = property_values[key];
            } else if ( this.constructor.PROPERTIES[key].value !== undefined ) {
                initial_value = this.constructor.PROPERTIES[key].value;
            }
            this.values_[key] = ValueHolder.adapt(initial_value);

            const listener_key = `property.${key}`;
            if ( property_values[listener_key] ) {
                this.values_[key].sub((value, more) => {
                    more = { ...more, component: this };
                    property_values[listener_key](value, more);
                });
            }
        }

        // Convenience for setting a property while composing components
        if ( property_values && property_values.hasOwnProperty('_ref') ) {
            property_values._ref(this);
        }

        // Setup focus handling
        if ( property_values && property_values[`event.focus`] ) {
            const on_focus_ = this.on_focus;
            this.on_focus = (...a) => {
                property_values[`event.focus`]();
                on_focus_ && on_focus_(...a);
            }
        }
        this.addEventListener('focus', () => {
            if ( this.on_focus ) {
                this.on_focus();
            }
        });
    }

    focus () {
        super.focus();
        // Apparently the 'focus' event only fires when the element is focused
        // by other means than calling .focus() on it, so this isn't redundant.

        // We use a 0ms timeout to ensure that the focus event has been
        // processed before we call on_focus, which may rely on the focus
        // event having been processed (and typically does).
        setTimeout(() => {
            if ( this.on_focus ) {
                this.on_focus();
            }
        }, 0);
    }

    get (key) {
        return this.values_[key].get();
    }

    set (key, value) {
        this.values_[key].set(value);
    }

    connectedCallback () {
        this.on_ready && this.on_ready(this.get_api_());
    }

    attach (destination) {
        const el = this.create_element_();
        this.dom_.appendChild(el);

        if ( destination instanceof HTMLElement ) {
            destination.appendChild(this);
            return;
        }

        if ( destination.$ === 'placeholder' ) {
            destination.replaceWith(this);
            return;
        }

        // TODO: generalize displaying errors about a value;
        //   always show: typeof value, value.toString()
        throw new Error(`Unknown destination type: ${destination}`);
    }

    place (slot_name, child_node) {
        child_node.setAttribute('slot', slot_name);
        this.appendChild(child_node);
    }

    create_element_ () {
        const template = document.createElement('template');
        if ( this.constructor.CSS ) {
            const style = document.createElement('style');
            style.textContent = this.constructor.CSS;
            this.dom_.appendChild(style);
        }
        if ( this.create_template ) {
            this.create_template({ template });
        }
        const el = template.content.cloneNode(true);
        return el;
    }

    get_api_ () {
        return {
            listen: (name, callback) => {
                this.values_[name].sub(callback);
                callback(this.values_[name].get(), {});
            }
        };
    }
}

export const defineComponent = (name, component) => {
    // TODO: This is necessary because files can be loaded from
    // both `/src/UI` and `/UI` in the URL; we need to fix that
    if ( ! customElements.get(name) ) {
        customElements.define(name, component);
    }
};
