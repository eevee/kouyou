// Color(red, green, blue)
// Constructor for a color object.
// Every channel is available as a property, although currently the HSL
// channels are not guaranteed to be live until after a call to
// this._recalc() -- this will be fixed with getters shortly.
// n.b.: Every value handled by this class is normalized to the [0, 1]
// range.  If you want 0-255, do it yourself and multiply by 255.
function Color(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.dirty = true;
}
Color.prototype = {
    colorspaces: [ {
        name: 'RGB',
        channels: ['r', 'g', 'b'],
        channel_names: ['Red', 'Green', 'Blue'],
    }, {
        name: 'HSL',
        channels: ['h', 's', 'l'],
        channel_names: ['Hue', 'Saturation', 'Lightness'],
    }, {
        name: 'HSV',
        channels: ['h', 't', 'v'],
        channel_names: ['Hue', 'Saturation', 'Value'],
    } ],

    // to_hex()
    // Returns the color this object represents formatted as a typical
    // HTML hex triple, i.e. #rrggbb.
    to_hex: function() {
        return '#' +
            ('0' + Math.floor(this.r * 255 + 0.5).toString(16)).substr(-2) +
            ('0' + Math.floor(this.g * 255 + 0.5).toString(16)).substr(-2) +
            ('0' + Math.floor(this.b * 255 + 0.5).toString(16)).substr(-2);
    },

    // -- Setters --

    // set_X(X)
    // Sets the given channel (identified by its single letter) to the
    // given value.
    set_r: function(r) { this.r = r; this.dirty = true; },
    set_g: function(g) { this.g = g; this.dirty = true; },
    set_b: function(b) { this.b = b; this.dirty = true; },

    set_h: function(h) { this._recalc(); this.from_hsl(h, this.s, this.l); },
    set_s: function(s) { this._recalc(); this.from_hsl(this.h, s, this.l); },
    set_l: function(l) { this._recalc(); this.from_hsl(this.h, this.s, l); },

    set_t: function(t) { this._recalc(); this.from_hsv(this.h, t, this.v); },
    set_v: function(v) { this._recalc(); this.from_hsv(this.h, this.t, v); },

    // randomize()
    // Sets the color to a random color.
    randomize: function() {
        this.r = Math.random();
        this.g = Math.random();
        this.b = Math.random();
        this.dirty = true;
    },

    // invert()
    // Inverts the color.
    invert: function() {
        this.r = 1 - this.r;
        this.g = 1 - this.g;
        this.b = 1 - this.b;
        this.dirty = true;
    },

    // complement()
    // Complements the color.
    complement: function() {
        this.r = (this.r + 0.5) % 1;
        this.g = (this.g + 0.5) % 1;
        this.b = (this.b + 0.5) % 1;
        this.dirty = true;
    },

    // -- Calculations --

    // _recalc()
    // Recalculates all channels from the current RGB values.  If hue or
    // saturation is undefined, its current value is kept.  If .dirty is
    // false, this method is a no-op.
    _recalc: function() {
        if (! this.dirty) return;

        var max = Math.max(this.r, this.g, this.b);
        var min = Math.min(this.r, this.g, this.b);
        var equal = max - min < 0.000001;  // lol floats
        if (equal) {
            if (this.h == undefined) this.h = 0;
        } else if (max == this.r)
            this.h = 1/6 * (this.g - this.b) / (max - min) + 1;
        else if (max == this.g)
            this.h = 1/6 * (this.b - this.r) / (max - min) + 1/3;
        else if (max == this.b)
            this.h = 1/6 * (this.r - this.g) / (max - min) + 2/3;

        this.h = this.h % 1;

        this.l = (min + max) / 2;

        if (equal) {
            if (this.s == undefined) this.s = 0;
        } else if (this.l <= 1/2)
            this.s = (max - min) / (max + min);
        else
            this.s = (max - min) / (2 - (max + min));

        if (max == 0) {
            if (this.t == undefined) this.t = 0;
        } else
            this.t = 1 - min / max;

        this.v = max;

        this.dirty = false;
    },

    // from_hex(triplet)
    // Parses a hex triplet.  Returns true on success.
    from_hex: function(triplet) {
        // For some reason, (xxx) with a multiplier does not work right
        var re = new RegExp(/^\s*#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})\s*$/i);
        var rgb = re.exec(triplet);

        if (rgb == null) return false;

        this.r = parseInt(rgb[1], 16) / 255;
        this.g = parseInt(rgb[2], 16) / 255;
        this.b = parseInt(rgb[3], 16) / 255;

        // Mark dirty, AND undefine saturation to force it to be recalculated
        this.dirty = true;
        this.s = undefined;
        this.t = undefined;

        return true;
    },

    // from_hsl(h, s, l)
    // Does some crazy number-crunching to convert the given hue, sat, and
    // lightness to RGB.
    from_hsl: function(h, s, l) {
        // Modified slightly from http://en.wikipedia.org/wiki/HSL_and_HSV
        this.h = h;
        this.s = s;
        this.l = l;

        var q;
        if (l < 0.5)
            q = l * (1 + s);
        else
            q = l + s - (l * s);

        var p = 2 * l - q;

        var t = {};
        t.r = (h + 1/3) % 1;
        t.g = h;
        t.b = (h + 2/3) % 1;

        for (ch in t) {
            if (t[ch] < 1/6)
                this[ch] = p + ((q - p) * 6 * t[ch]);
            else if (t[ch] < 1/2)
                this[ch] = q;
            else if (t[ch] < 2/3)
                this[ch] = p + ((q - p) * 6 * (2/3 - t[ch]));
            else
                this[ch] = p;
        }

        this.dirty = true;
        this.t = undefined;
    },

    // from_hsv(h, t, v)
    // Well, duh.
    from_hsv: function(h, t, v) {
        // Modified slightly from http://en.wikipedia.org/wiki/HSL_and_HSV
        this.h = h;
        this.t = t;
        this.v = v;

        var h_idx = Math.floor(h * 6) % 6;
        var f = h * 6 - h_idx;
        window.status = h + ' ' + h_idx + ' ' + f;
        var p = v * (1 - t);
        var q = v * (1 - f * t);
        var u = v * (1 - (1 - f) * t);

        switch (h_idx) {
        case 0:
            this.r = v;
            this.g = u;
            this.b = p;
            break;
        case 1:
            this.r = q;
            this.g = v;
            this.b = p;
            break;
        case 2:
            this.r = p;
            this.g = v;
            this.b = u;
            break;
        case 3:
            this.r = p;
            this.g = q;
            this.b = v;
            break;
        case 4:
            this.r = u;
            this.g = p;
            this.b = v;
            break;
        case 5:
            this.r = v;
            this.g = p;
            this.b = q;
            break;
        }

        this.dirty = true;
        this.s = undefined;
    },

    // -- Utilities --

    // clone()
    // Returns a copy of this color.
    clone: function() {
        // Javascript has no real concept of classes; "new Foo()" really
        // just returns a shallow copy of Foo.prototype.  Thus, to clone
        // an object with only scalar properties, do the same thing
        var other = {};
        for (var key in this)
            other[key] = this[key];
        return other;
    },

    // assume(hash)
    // Returns a color object identical to this one, except that the hash
    // of channels => values provided are applied.  These are applied in
    // arbitrary order, so supplying channels from multiple colorspaces
    // is undefined.
    assume: function(assumptions) {
        var other = this.clone();
        for (var channel in assumptions) {
            other['set_' + channel]( assumptions[channel] );
        }
        return other;
    },
};

// --- Utility functions ---

var current_color = new Color(0, 0, 0);

// update_color()
// Synchronizes the page contents with the current color.  Sliders,
// gradients, the current color box, and so forth are updated.
function update_color() {
    current_color._recalc();

    // Adjust background and label for current-color box.
    var hex = current_color.to_hex();
    $('#current-color #color-name').text(hex);
    $('#current-color #color-background').css('background-color', hex);
    $('#current-color #color-text').css('color', hex);

    // Iterate over each channel on the page
    for (var cs in Color.prototype.colorspaces) {
        var colorspace = Color.prototype.colorspaces[cs];
        var cs_name = colorspace.name.toLowerCase();
        for (var c in colorspace.channels) {
            var channel = colorspace.channels[c];
            var id = cs_name + '-' + channel;

            // Update value and marker position
            $('#' + id + ' .value').text(Math.round(current_color[channel] * 10000) / 100 + '%');
            $('#' + id + ' .marker').css('left', current_color[channel] * 100 + '%');

            // Iterate over stops and update their colors, using assume()
            // to see what they *would* be if the slider were there.  Note
            // that hue and lightness are special cases; hue runs through
            // the rainbow and needs several stops, whereas lightness runs
            // from black to a full color and then back to white, needing
            // an extra stop in the middle.
            var stops = $('#' + id + ' stop');
            var assumption = {};
            for (var i = 0; i < stops.length; i++) {
                assumption[channel] = i / (stops.length - 1);
                stops.get(i).setAttributeNS(null, 'stop-color', current_color.assume(assumption, cs_name).to_hex());
            }
        }
    }
}

// --- Event handlers ---

// create_sliders()
// Creates the slider controls, including a header per colorspace and a
// label/slider/value for each channel.
function create_sliders() {
    // Iterate over colorspaces, then channels..
    for (var cs in Color.prototype.colorspaces) {
        var colorspace = Color.prototype.colorspaces[cs];
        var cs_name = colorspace.name.toLowerCase();

        var $colorspace_el = $('<div class="colorspace"></div>');
        $(document.body).append($colorspace_el);

        for (var c in colorspace.channels) {
            var channel = colorspace.channels[c];
            var channel_name = colorspace.channel_names[c];
            var id = cs_name + '-' + channel;

            // There's a lot of SVG stuff to insert and DOM manipulation
            // is unreadable garbage, so just shove in an HTML fragment
            // (n.b.: backslashes needed because ; in JS is optional)
            $colorspace_el.append(' \
<div class="slider-row" id="' + id + '"> \
<div class="label">' + channel_name + '</div> \
<div class="value">100%</div> \
<div class="slider"> \
    <div class="marker"></div> \
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" preserveAspectRatio="none"> \
        <defs> \
            <linearGradient id="grad-' + id + '"/> \
        </defs> \
        <rect x="0" y="0" width="10" height="10" fill="url(#grad-' + id + ')"/> \
    </svg> \
</div> \
</div> \
            ');

            // Create the stops for this channel, space them equally, and
            // give them default values; hue and lightness are special
            // cases, as mentioned above
            var stop_ct = 2;
            if (channel == 'h')
                stop_ct = 7;
            else if (channel == 'l')
                stop_ct = 3;
            var svg_doc = $colorspace_el.find('#' + id + ' svg').get(0).ownerDocument;
            for (var i = 1; i <= stop_ct; i++) {
                var stop = svg_doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop.setAttributeNS(null, 'offset', (i - 1) / (stop_ct - 1));
                stop.setAttributeNS(null, 'stop-color', '#999999');
                svg_doc.getElementById('grad-' + id).appendChild(stop);
            }
        }
    }
}

// --- Dragging ---

// Remember what slider is currently being moved around
var current_slider = null;

// mousedown
// Registers the target slider as the current one.
function mousedown(event) {
    // Use currentTarget to get the registered listener; actual click will
    // hit a child element
    var el = event.currentTarget;
    if (el.className != 'slider') return;

    current_slider = el;
    event.preventDefault();
    mousemove(event);
}

// mousemove
// Calculates how far along the slider the mouse is now, changes the color
// accordingly, and updates the screen.  Value is clipped to [0, 1].
function mousemove(event) {
    if (! current_slider) return;

    var pct = (event.pageX - current_slider.offsetLeft) / current_slider.offsetWidth;
    if (pct < 0) pct = 0;
    if (pct > 1) pct = 1;

    var parts = current_slider.parentNode.id.split('-');
    current_color['set_' + parts[1]](pct);
    update_color();
}

// mouseup
// Blanks the currently registered slider.
function mouseup(event) {
    current_slider = null;
}

// --- Buttons ---

// get_from_hex()
// Sets the current color to the specified hex triplet.
function get_from_hex() {
    var hex = prompt("Enter a hex triplet in the form #rrggbb:");
    if (hex == null) return;

    var success = current_color.from_hex(hex);
    if (success)
        update_color();
    else
        alert("Invalid color.");
}

// do_to_color(method)
// Calls the given method on the current color and updates the display.
function do_to_color(method) {
    current_color[method]();
    update_color();
}

// --- Onload ---

// Creates everything, updates the screen, and registers handlers.
$( function() {
    create_sliders();
    update_color();
    $('.slider').mousedown(mousedown);
    $(document).mousemove(mousemove);
    $(document).mouseup(mouseup);

    // Buttons
    $('#js-from-hex').click(get_from_hex);
    $('#js-randomize').click(function() { do_to_color('randomize') });
    $('#js-invert').click(function() { do_to_color('invert') });
    $('#js-complement').click(function() { do_to_color('complement') });
} );