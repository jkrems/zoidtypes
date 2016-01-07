var TypeTerminal = (function () {
    function TypeTerminal(name) {
        this.name = name;
    }
    Object.defineProperty(TypeTerminal.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TypeTerminal.prototype.toString = function () { return this.name; };
    return TypeTerminal;
})();
exports.TypeTerminal = TypeTerminal;
var TypeUnion = (function () {
    function TypeUnion(types) {
        this.types = types;
    }
    Object.defineProperty(TypeUnion.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TypeUnion.prototype.toString = function (unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        var typeList = this.types.map(function (t) { return t.toString(unknowns); });
        return "{" + typeList.join('|') + "}";
    };
    return TypeUnion;
})();
exports.TypeUnion = TypeUnion;
var TypeVariable = (function () {
    function TypeVariable(name) {
        this.name = name || null;
        this._actual = null;
    }
    Object.defineProperty(TypeVariable.prototype, "actual", {
        get: function () {
            return (this._actual && this._actual.actual) || this;
        },
        set: function (actual) {
            this._actual = actual;
        },
        enumerable: true,
        configurable: true
    });
    TypeVariable.prototype.toString = function (unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        if (this._actual !== null) {
            return this.actual.toString(unknowns);
        }
        if (!unknowns.has(this)) {
            unknowns.set(this, "'" + (this.name || unknowns.size));
        }
        return unknowns.get(this);
    };
    return TypeVariable;
})();
exports.TypeVariable = TypeVariable;
var TypeConstraint = (function () {
    function TypeConstraint(name) {
        if (name === void 0) { name = null; }
        this.name = name;
    }
    Object.defineProperty(TypeConstraint.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TypeConstraint.prototype.toString = function (unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        if (!unknowns.has(this)) {
            unknowns.set(this, "'" + unknowns.size);
        }
        return unknowns.get(this);
    };
    return TypeConstraint;
})();
exports.TypeConstraint = TypeConstraint;
var TemplateType = (function () {
    function TemplateType(name, constraints) {
        this.name = name;
        if (Array.isArray(constraints)) {
            if (constraints.length !== 1) {
                throw new Error('Better logic still needed');
            }
            constraints = constraints.reduce(function (out, key) {
                out[key] = new TypeConstraint();
                return out;
            }, {});
        }
        this.params = Object.keys(constraints);
        this.constraints = constraints;
    }
    TemplateType.prototype.format = function (args, unknowns) {
        if (unknowns === void 0) { unknowns = new Map(); }
        var argList = args.map(function (arg) { return arg.toString(unknowns); });
        return this.name + "<" + argList.join(', ') + ">";
    };
    TemplateType.prototype.create = function (args) {
        return new TemplateTypeInstance(this, args);
    };
    return TemplateType;
})();
exports.TemplateType = TemplateType;
var TemplateTypeInstance = (function () {
    function TemplateTypeInstance(template, args) {
        this.template = template;
        this.args = args;
    }
    Object.defineProperty(TemplateTypeInstance.prototype, "actual", {
        get: function () { return this; },
        enumerable: true,
        configurable: true
    });
    TemplateTypeInstance.prototype.toString = function (unknowns) {
        return this.template.format(this.args, unknowns);
    };
    return TemplateTypeInstance;
})();
exports.TemplateTypeInstance = TemplateTypeInstance;
exports.FUNCTION = new TemplateType('Function', {
    Input: new TypeConstraint(),
    Output: new TypeConstraint(),
});
exports.FUNCTION.format = function formatFunction(rawArgs, unknowns) {
    unknowns = unknowns || new Map();
    var args = [rawArgs[0]];
    var result = rawArgs[1];
    while (result.template === exports.FUNCTION) {
        var tArgs = result.args;
        args.push(tArgs[0]);
        result = tArgs[1];
    }
    var argList = args.map(function (arg) { return arg.toString(unknowns); }).join(', ');
    return "(" + argList + ") -> " + result.toString(unknowns);
};
