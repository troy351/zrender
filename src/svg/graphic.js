// TODO
// 1. shadow
// 2. Image: sx, sy, sw, sh
define(function (require) {
			
	var svgCore = require('./core');
	var CMD = require('../core/PathProxy').CMD;
    var textContain = require('../contain/text');
	
	var createElement = svgCore.createElement;
	var arrayJoin = Array.prototype.join;

	var NONE = 'none';
    var mathRound = Math.round;
    var mathSin = Math.sin;
    var mathCos = Math.cos;
    var PI = Math.PI;
    var PI2 = Math.PI * 2;
    var degree = 180 / PI;

    var EPSILON = 1e-4;

    function round4(val) {
        return mathRound(val * 1e4) / 1e4;
    }

    function isAroundZero(val) {
        return val < EPSILON && val > -EPSILON;
    }

    function pathHasFill(style, isText) {
        var fill = isText ? style.textFill : style.fill;
        return fill != null && fill !== NONE;
    }

    function pathHasStroke(style, isText) {
        var stroke = isText ? style.textStroke : style.stroke;
        return stroke != null && stroke !== NONE;
    }

	function setTransform(svgEl, m) {
		if (m) {
			attr(svgEl, 'transform', 'matrix(' + arrayJoin.call(m, ',') + ')');
		}
	}

    function append(parent, child) {
        if (child && parent && child.parentNode !== parent) {
            parent.appendChild(child);
        }
    }

    function remove(parent, child) {
        if (child && parent && child.parentNode === parent) {
            parent.removeChild(child);
        }
    }

    function attr(el, key, val) {
    	el.setAttribute(key, val);
    }

    function attrXLink(el, key, val) {
        el.setAttributeNS('http://www.w3.org/1999/xlink', key, val);
    }

    function bindStyle(svgEl, style, isText) {
    	if (pathHasFill(style, isText)) {
    		attr(svgEl, 'fill', isText ? style.textFill : style.fill);
    		attr(svgEl, 'fill-opacity', style.opacity);
    	}
    	else {
    		attr(svgEl, 'fill', NONE);
    	}
    	if (pathHasStroke(style, isText)) {
    		attr(svgEl, 'stroke', isText ? style.textStroke : style.fill);
    		attr(svgEl, 'stroke-width', style.lineWidth);
    		attr(svgEl, 'stroke-opacity', style.opacity);
    		var lineDash = style.lineDash;
    		if (lineDash) {
                attr(svgEl, 'stroke-dasharray', style.lineDash.join(','));
    		    attr(svgEl, 'stroke-dashoffset', mathRound(style.lineDashOffset || 0));
            }
            else {
                attr(svgEl, 'stroke-dasharray', '');
            }

    		// PENDING
    		style.lineCap && attr(svgEl, 'stroke-linecap', style.lineCap);
    		style.lineJoin && attr(svgEl, 'stroke-linejoin', style.lineJoin);
    		style.miterLimit && attr(svgEl, 'stroke-miterlimit', style.miterLimit);
    	}
    	else {
    		attr(svgEl, 'stroke', NONE);
    	}
    }

    var ZLEVEL_BASE = 10000;

    function getZIndex(zlevel, z) {
        // z 的取值范围为 [0, 1000]
        return (parseInt(zlevel) || 0) * ZLEVEL_BASE + parseInt(z) || 0;
    }

    /***************************************************
     * PATH
     **************************************************/
	function pathDataToString(data) {
		var str = [];
		for (var i = 0; i < data.length;) {
			var cmd = data[i++];
			var cmdStr = '';
			var nData = 0;
			switch (cmd) {
				case CMD.M:
					cmdStr = 'M';
					nData = 2;
					break;
				case CMD.L:
					cmdStr = 'L';
					nData = 2;
					break;
				case CMD.Q:
					cmdStr = 'Q';
					nData = 4;
					break;
				case CMD.C:
					cmdStr = 'C';
					nData = 6;
					break;
				case CMD.A:
                    var cx = data[i++];
                    var cy = data[i++];
                    var rx = data[i++];
                    var ry = data[i++];
                    var theta = data[i++];
                    var dTheta = data[i++];
                    var psi = data[i++];
                    var clockwise = data[i++];
                    var sign = clockwise ? 1 : -1;

                    var x0 = round4(cx + rx * mathCos(theta));
                    var y0 = round4(cy + ry * mathSin(theta) * sign);
                    var x = round4(cx + rx * mathCos(theta + dTheta));
                    var y = round4(cy + ry * mathSin(theta + dTheta) * sign);

                    if (! (x0 === x && y0 === y)) {
                        // Add a line to start point
                        str.push('L', x0, y0);
                    }
                    else {
                        // Is a circle
                        if (! isAroundZero(dTheta)) {
                            // It will not draw if start point and end point are exactly the same
                            // We need to shift the end point with a exreme small value
                            // But if the value is not small enough, the precision problem
                            // will cause the circle drawn in a wrong direction.
                            x += 1e-8;
                            y += 1e-8;
                        }
                    }

                    var large = dTheta > PI;
                    // Adjust clockwise to make sure center of circle is right
                    // PENDING Test if the logic is right
                    clockwise = (large && x < cx) || (! large && x > cx);
                    // FIXME Ellipse
                    str.push('A',round4(rx), round4(ry), mathRound((psi + theta) * degree), +large, +clockwise, x, y);
					break;
				case CMD.Z:
					cmdStr = 'Z';
					break;
			}
			cmdStr && str.push(cmdStr);
			for (var j = 0; j < nData; j++) {
                // PENDING With scale
				str.push(round4(data[i++]));
			}
		}
		return str.join(' ');
	}

	var svgPath = {};

	svgPath.brush = function (el, svgRoot) {
		var style = el.style;

		var svgEl = el.__svgEl;
		if (! svgEl) {
			svgEl = createElement('path');
			el.__svgEl = svgEl;
		}
        // FIXME Do not access private property!
		var path = el._path;
		if (el.__dirtyPath) {
			path.beginPath();
			el.buildPath(path, el.shape);
			el.__dirtyPath = false;

			attr(svgEl, 'd', pathDataToString(path.data));
		}

		bindStyle(svgEl, style);
		setTransform(svgEl, el.transform);

        svgEl.style.zIndex = getZIndex(el.zlevel, el.z);

		append(svgRoot, svgEl);

        if (style.text) {
            svgTextDrawRectText(el, svgRoot, el.getBoundingRect());
        }
	};

	svgPath.onRemoveFromStorage = function (el, svgRoot) {
		remove(svgRoot, el.__svgEl);

        svgTextOnRemoveFromStorage(el, svgRoot);
	};

	svgPath.onAddToStorage = function (el, svgRoot) {
		append(svgRoot, el.__svgEl);

        svgTextOnAddToStorage(el, svgRoot);
	};

    /***************************************************
     * IMAGE
     **************************************************/
    var svgImage = {}

    svgImage.brush = function (el, svgRoot) {
        var style = el.style;
        var image = style.image;

        if (image instanceof HTMLImageElement) {
            var src = image.src;
            image = src;
        }
        if (! image) {
            return;
        }

        var x = style.x || 0;
        var y = style.y || 0;

        var dw = style.width;
        var dh = style.height;

        var svgEl = el.__svgEl;
        if (! svgEl) {
            svgEl = createElement('image');
            el.__svgEl = svgEl;
        }

        if (image !== el.__imageSrc) {
            attrXLink(svgEl, 'href', image);
            // Caching image src
            el.__imageSrc = image;
        }

        attr(svgEl, 'width', dw);
        attr(svgEl, 'height', dh);

        setTransform(svgEl, el.transform);

        svgEl.style.zIndex = getZIndex(el.zlevel, el.z);

        append(svgRoot, svgEl);

        if (style.text) {
            svgTextDrawRectText(el, svgRoot, el.getBoundingRect());
        }
    };

    svgImage.onRemoveFromStorage = function (el, svgRoot) {
        remove(svgRoot, el.__svgEl);

        svgTextOnRemoveFromStorage(el, svgRoot);
    };

    svgImage.onAddToStorage = function (el, svgRoot) {
        append(svgRoot, el.__svgEl);

        svgTextOnAddToStorage(el, svgRoot);
    };

    /***************************************************
     * TEXT
     **************************************************/
    var svgText = {};

    svgTextDrawRectText = function (el, svgRoot, rect, textRect) {
        var style = el.style;
        var text = style.text;

        if (! text) {
            return;
        }

        var textSvgEl = el.__textSvgEl;
        if (! textSvgEl) {
            textSvgEl = createElement('text');
            el.__textSvgEl = textSvgEl;
        }

        bindStyle(textSvgEl, style, true);
        setTransform(textSvgEl, el.transform);

        var x;
        var y;
        var textPosition = style.textPosition;
        var distance = style.textDistance;
        var align = style.textAlign;
        // Default font
        var font = style.textFont || '12px sans-serif';
        var baseline = style.textBaseline;

        textRect = textRect || textContain.getBoundingRect(text, font, align, baseline);

        var lineHeight = textRect.lineHeight;
        // Text position represented by coord
        if (textPosition instanceof Array) {
            x = textPosition[0];
            y = textPosition[1];
        }
        else {
            var newPos = textContain.adjustTextPositionOnRect(
                textPosition, rect, textRect, distance
            );
            x = newPos.x;
            y = newPos.y;
        }

        if (font) {
            textSvgEl.style.font = font;
        }

        // Make baseline top
        attr(textSvgEl, 'x', x);
        attr(textSvgEl, 'y', y);

        var textLines = text.split('\n');
        var nTextLines = textLines.length;
        // Font may affect position of each tspan elements
        if (el.__text !== text || el.__textFont !== font) {
            var tspanList = el.__tspanList || [];
            el.__tspanList = tspanList;
            for (var i = 0; i < nTextLines; i++) {
                // Using cached tspan elements
                var tspan = tspanList[i];
                if (! tspan) {
                    tspan = tspanList[i] = createElement('tspan');
                    append(textSvgEl, tspan);
                    attr(tspan, 'alignment-baseline', 'hanging');
                    // attr(tspan, 'text-anchor', 'start');
                }
                attr(tspan, 'x', x);
                attr(tspan, 'y', y + i * lineHeight);
                tspan.innerHTML = textLines[i];
            }
            // Remove unsed tspan elements
            for (; i < tspanList.length; i++) {
                remove(textSvgEl, tspanList[i]);
            }
            tspanList.length = nTextLines;

            el.__text = text;
            el.__textFont = font;
        }

        textSvgEl.style.zIndex = getZIndex(el.zlevel, el.z);

        append(svgRoot, textSvgEl);
    };

    svgTextRemoveRectText = function (el, svgRoot) {
        remove(svgRoot, el.__textSvgEl);
    };

    svgTextOnAddToStorage = function (el, svgRoot) {
        append(svgRoot, el.__textSvgEl);
    };

    svgTextOnRemoveFromStorage = function (el, svgRoot) {
        remove(svgRoot, el.__textSvgEl);
    };

    svgText.drawRectText = svgTextDrawRectText;
    svgText.removeRectText = svgTextRemoveRectText;
    svgText.onAddToStorage = svgTextOnAddToStorage;
    svgText.onRemoveFromStorage = svgTextOnRemoveFromStorage;

    svgText.brush = function (el, svgRoot) {
        var style = el.style;
        if (style.text) {
            svgTextDrawRectText(el, svgRoot, {
                x: style.x || 0, y: style.y || 0,
                width: 0, height: 0
            }, el.getBoundingRect());
        }
    };

	return {
		path: svgPath,
        image: svgImage,
        text: svgText
	};
});