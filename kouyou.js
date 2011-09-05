(function(){  // namespace
"use strict";


////// Colorspace definitions

var CHANNELS = {
    RED:        { stops: 2, name: 'red' },
    GREEN:      { stops: 2, name: 'green' },
    BLUE:       { stops: 2, name: 'blue' },
    HUE:        { stops: 7, name: 'hue' },
    HSL_SAT:    { stops: 2, name: 'saturation' },
    HSV_SAT:    { stops: 2, name: 'saturation' },
    LIGHTNESS:  { stops: 3, name: 'lightness' },
    VALUE:      { stops: 2, name: 'value' },
};
$.each(CHANNELS, function(key, val) {
    val.identifier = key;
});

var COLORSPACES = {
    RGB: { name: 'RGB', channels: [ 'RED', 'GREEN', 'BLUE' ] },
    HSL: { name: 'HSL', channels: [ 'HUE', 'HSL_SAT', 'LIGHTNESS' ] },
    HSV: { name: 'HSV', channels: [ 'HUE', 'HSV_SAT', 'VALUE' ] },
};
$.each(COLORSPACES, function(key, val) {
    val.identifier = key;
    val.channels = $.map(val.channels, function(ch) { return CHANNELS[ch] });
});

// Conversions to/from RGB; each accept a triplet and return a triplet

COLORSPACES.RGB.convert_to_rgb = function(r, g, b) {
    return [r, g, b];
};

COLORSPACES.RGB.convert_from_rgb = function(r, g, b) {
    return [r, g, b];
};

COLORSPACES.HSL.convert_to_rgb = function(h, s, l) {
    // Modified slightly from http://en.wikipedia.org/wiki/HSL_and_HSV
    var t = [
        (h + 1/3) % 1,  // initial red
        h,              // initial green
        (h + 2/3) % 1,  // initial blue
    ];

    var q;
    if (l < 0.5) {
        q = l * (1 + s);
    }
    else {
        q = l + s - (l * s);
    }

    var p = 2 * l - q;

    for (var i in t) {
        if (t[i] < 1/6) {
            t[i] = p + ((q - p) * 6 * t[i]);
        }
        else if (t[i] < 1/2) {
            t[i] = q;
        }
        else if (t[i] < 2/3) {
            t[i] = p + ((q - p) * 6 * (2/3 - t[i]));
        }
        else {
            t[i] = p;
        }
    }

    return t;
},

COLORSPACES.HSL.convert_from_rgb = function(r, g, b) {
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;

    var h;
    if (delta < 0.000001) {
        h = null;
    }
    else if (max === r) {
        h = 1/6 * (g - b) / delta + 1;
    }
    else if (max === g) {
        h = 1/6 * (b - r) / delta + 1/3;
    }
    else if (max === b) {
        h = 1/6 * (r - g) / delta + 2/3;
    }

    if (h) {
        h %= 1;
    }

    var s;
    if (delta < 0.000001) {
        s = null;
    }
    else if (l <= 1/2) {
        s = (max - min) / (max + min);
    }
    else {
        s = (max - min) / (2 - (max + min));
    }

    var l = (min + max) / 2;

    return [h, s, l];
};

COLORSPACES.HSV.convert_to_rgb = function(h, s, v) {
    // Modified slightly from http://en.wikipedia.org/wiki/HSL_and_HSV
    var h_idx = Math.floor(h * 6) % 6;
    var f = h * 6 - h_idx;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var u = v * (1 - (1 - f) * s);

    switch (h_idx) {
        case 0: return [v, u, p];
        case 1: return [q, v, p];
        case 2: return [p, v, u];
        case 3: return [p, q, v];
        case 4: return [u, p, v];
        case 5: return [v, p, q];
    }
};

COLORSPACES.HSV.convert_from_rgb = function(r, g, b) {
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;

    var h;
    if (delta < 0.000001) {
        h = null;
    }
    else if (max === r) {
        h = 1/6 * (g - b) / delta + 1;
    }
    else if (max === g) {
        h = 1/6 * (b - r) / delta + 1/3;
    }
    else if (max === b) {
        h = 1/6 * (r - g) / delta + 2/3;
    }

    if (h) {
        h %= 1;
    }

    var s;
    if (max == 0) {
        s = null;
    }
    else {
        s = 1 - min / max;
    }

    var v = max;

    return [h, s, v];
};


// Color()
// Constructor for a color object.  Initially black.
// Every channel is available as a property, although currently the HSL
// channels are not guaranteed to be live until after a call to
// this._recalc() -- this will be fixed with getters shortly.
// n.b.: Every value handled by this class is normalized to the [0, 1]
// range.  If you want 0-255, do it yourself and multiply by 255.
function Color() {
    var self = this;

    // _data maps channel names to their current state
    this._values = {};
    $.each(CHANNELS, function(key) {
        self._values[key] = 0;
    });
}
Color.prototype = {

    // to_hex()
    // Returns the color this object represents formatted as a typical
    // HTML hex triple, i.e. #rrggbb.
    to_hex: function() {
        return '#' +
            ('0' + Math.floor((this._values.RED || 0) * 255 + 0.5).toString(16)).substr(-2) +
            ('0' + Math.floor((this._values.GREEN || 0) * 255 + 0.5).toString(16)).substr(-2) +
            ('0' + Math.floor((this._values.BLUE || 0) * 255 + 0.5).toString(16)).substr(-2);
    },

    // -- Setters --

    set: function(channel, value) {
        // Find a colorspace containing this channel
        var colorspace;
        for (var cs in COLORSPACES) {
            if (COLORSPACES[cs].channels.indexOf(channel) > -1) {
                colorspace = COLORSPACES[cs];
                break;
            }
        }

        // Convert from that colorspace
        var from_values = [];
        for (var i in colorspace.channels) {
            var each_channel = colorspace.channels[i];
            if (each_channel === channel) {
                from_values.push(value);
            }
            else {
                from_values.push(this._values[each_channel.identifier]);
            }
        }

        this.from_colorspace(colorspace, from_values);
    },

    from_colorspace: function(colorspace, values) {
        // Store the given values for their colorspace
        for (var i in colorspace.channels) {
            this._values[colorspace.channels[i].identifier] = values[i];
        }

        // Convert to RGB
        var rgb = colorspace.convert_to_rgb.apply(null, values);
        this._values.RED   = rgb[0];
        this._values.GREEN = rgb[1];
        this._values.BLUE  = rgb[2];

        // Refresh the other colorspaces
        for (var cs in COLORSPACES) {
            var other_colorspace = COLORSPACES[cs];

            if (other_colorspace === COLORSPACES.RGB || other_colorspace === colorspace) {
                // Either RGB or the given colorspace; neither needs updating
                continue;
            }

            var converted = other_colorspace.convert_from_rgb.apply(null, rgb);
            for (var i in other_colorspace.channels) {
                if (converted[i] !== null) {
                    this._values[other_colorspace.channels[i].identifier] = converted[i];
                }
            }
        }
    },

    get: function(channel) {
        return this._values[channel.identifier];
    },

    // XXX maybe make a cool mutate(colorspace, func) method

    // randomize()
    // Sets the color to a random color.
    randomize: function() {
        this.from_colorspace(COLORSPACES.RGB, [
            Math.random(), Math.random(), Math.random(),
        ]);
    },

    // invert()
    // Inverts the color.
    invert: function() {
        this.from_colorspace(COLORSPACES.RGB, [
            1 - this._values.RED,
            1 - this._values.GREEN,
            1 - this._values.BLUE,
        ]);
    },

    // complement()
    // Complements the color.
    complement: function() {
        this.from_colorspace(COLORSPACES.RGB, [
            (this._values.RED + 0.5) % 1,
            (this._values.GREEN + 0.5) % 1,
            (this._values.BLUE + 0.5) % 1,
        ]);
    },

    // -- Calculations --

    // parse_color(str)
    // Parses a CSS color.  Returns true on success.
    parse_color: function(str) {
        // Create a dummy DOM node and let the browser parse for us
        var parsed_color = $('<div>')
            .css('background-color', 'transparent')
            .css('background-color', str)
            .css('background-color');

        if (parsed_color === 'transparent') {
            // Junk entered
            return false;
        }

        // TODO do all browsers normalize like this?
        var re = /^rgba?[(](\d+), (\d+), (\d+)(?:, [0-9.]+)?[)]$/;
        var rgba = re.exec(parsed_color);
        if (rgba === null) {
            return false;
        }

        this.from_colorspace(COLORSPACES.RGB, [
            parseInt(rgba[1], 10) / 255,
            parseInt(rgba[2], 10) / 255,
            parseInt(rgba[3], 10) / 255,
        ]);
        // TODO support alpha?

        // TODO it would be nice to preserve the saturation if the user entered hsl()

        return true;
    },

    // -- Utilities --

    // clone()
    // Returns a copy of this color.
    clone: function() {
        // Javascript has no real concept of classes; "new Foo()" really
        // just returns a shallow copy of Foo.prototype.  Thus, to clone
        // an object with only scalar properties, do the same thing
        var other = new Color();
        for (var ch in CHANNELS) {
            other._values[ch] = this._values[ch];
        }
        return other;
    },

    // assume(hash)
    // Returns a color object identical to this one, except that the hash
    // of channels => values provided are applied.  These are applied in
    // arbitrary order, so supplying channels from multiple colorspaces
    // is undefined.
    assume: function(assumptions) {
        var other = this.clone();
        for (var ch in assumptions) {
            other.set(CHANNELS[ch], assumptions[ch]);
        }
        return other;
    },
};

// --- Utility functions ---

var current_color = new Color();

// refresh_color_display()
// Updates the display of the current color.
function refresh_color_display() {
    var hex = current_color.to_hex();
    $('#current-color #color-identifiers').text(hex);
    $('#current-color #color-background').css('background-color', hex);
    $('#current-color #color-text').css('color', hex);
}

// update_color()
// Synchronizes the page contents with the current color.  Sliders,
// gradients, the current color box, and so forth are updated.
function update_color() {
    refresh_color_display();

    // Iterate over each channel on the page
    for (var cs in COLORSPACES) {
        var colorspace = COLORSPACES[cs];
        var cs_name = colorspace.identifier;
        for (var i in colorspace.channels) {
            var channel = colorspace.channels[i];
            var id = cs_name + '-' + channel.identifier;

            // Update value and marker position
            update_slider(colorspace, channel);

            // Iterate over stops and update their colors, using assume()
            // to see what they *would* be if the slider were there.  Note
            // that hue and lightness are special cases; hue runs through
            // the rainbow and needs several stops, whereas lightness runs
            // from black to a full color and then back to white, needing
            // an extra stop in the middle.
            var stop_ct = channel.stops;

            var $canvas = $('#' + id + ' canvas');
            var ctx = $canvas[0].getContext('2d');

            var grad = ctx.createLinearGradient(0, 0, 100, 0);
            var assumption = {};
            for (var i = 0; i < stop_ct; i++) {
                var offset = i / (stop_ct - 1);
                assumption[channel.identifier] = offset;
                grad.addColorStop(offset, current_color.assume(assumption).to_hex());
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 100, 100);
        }
    }
}

// update_slider(colorspace, channel)
// Updates the marker position and numeric value for this channel.
function update_slider(colorspace, channel) {
    var id = colorspace.identifier + '-' + channel.identifier;
    var value = current_color.get(channel) || 0;
    $('#' + id + ' .value').text(Math.round(value * 10000) / 100 + '%');
    $('#' + id + ' .marker').css('left', value * 100 + '%');
}

// --- Event handlers ---

// create_sliders()
// Creates the slider controls, including a header per colorspace and a
// label/slider/value for each channel.
function create_sliders() {
    // Iterate over colorspaces, then channels..
    for (var cs in COLORSPACES) {
        var colorspace = COLORSPACES[cs];
        var cs_name = colorspace.identifier;

        var $colorspace_el = $('<div class="colorspace"></div>');
        $('#color-picker').append($colorspace_el);

        for (var i in colorspace.channels) {
            var channel = colorspace.channels[i];
            var channel_name = channel.name;
            var id = cs_name + '-' + channel.identifier;

            // There's a lot of stuff to insert and DOM manipulation
            // is unreadable garbage, so just shove in an HTML fragment
            // (n.b.: backslashes needed because ; in JS is optional)
            $colorspace_el.append(' \
<div class="slider-row" id="' + id + '"> \
<div class="label">' + channel_name + '</div> \
<div class="value">100%</div> \
<div class="slider"> \
    <div class="marker"></div> \
    <canvas height="100" width="100"></canvas> \
</div> \
</div> \
            ');
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

    // XXX don't mousemove; update_color()
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
    current_color.set(CHANNELS[parts[1]], pct);

    // To make mouse movement smooth: update the display of the color, but do
    // NOT redraw all the other gradients until the mouse stops moving
    refresh_color_display();
    // XXX: update_slider()
    update_color();
}

// mouseup
// Blanks the currently registered slider.
function mouseup(event) {
    current_slider = null;
}

// --- Buttons ---

// parse_color()
// Sets the current color to a given CSS color value.
function parse_color() {
    var value = prompt("Enter a color value.");
    if (! value) return;

    var success = current_color.parse_color(value);
    if (success) {
        update_color();
    }
    else {
        alert("Invalid color.");
    }
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
    $('#js-parse').click(parse_color);
    $('#js-randomize').click(function() { do_to_color('randomize') });
    $('#js-invert').click(function() { do_to_color('invert') });
    $('#js-complement').click(function() { do_to_color('complement') });
} );


})();  // end namespace
