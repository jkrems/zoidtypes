var types_1 = require('./types');
/* END: ES6 Map */
var Scope = (function () {
    function Scope(parent) {
        if (parent === void 0) { parent = null; }
        this.parent = parent;
        this.known = new Map();
    }
    Scope.prototype.createFunctionType = function (args, result) {
        args = args.slice(0);
        var current = types_1.FUNCTION.create([args.pop(), result]);
        while (args.length) {
            current = types_1.FUNCTION.create([args.pop(), current]);
        }
        return current;
    };
    Scope.prototype.createUnion = function (types) {
        return new types_1.TypeUnion(types);
    };
    Scope.prototype.register = function (type) {
        if (typeof type.name !== 'string') {
            throw new Error("Could not find .name property of " + type);
        }
        return this.set(type.name, type);
    };
    Scope.prototype.registerTerminal = function (name) {
        if (this.known.has(name)) {
            return this.known.get(name);
        }
        return this.set(name, new types_1.TypeTerminal(name));
    };
    Scope.prototype.registerTemplate = function (name, constraints) {
        if (this.known.has(name)) {
            return this.known.get(name);
        }
        return this.set(name, new types_1.TemplateType(name, constraints));
    };
    Scope.prototype.set = function (key, value) {
        this.known.set(key, value);
        return value;
    };
    Scope.prototype.get = function (key) {
        if (this.known.has(key)) {
            return this.known.get(key);
        }
        else if (this.parent !== null) {
            return this.parent.get(key);
        }
        else {
            throw new Error("Not defined: " + key);
        }
    };
    Scope.prototype.has = function (key) {
        return this.known.has(key) || (this.parent !== null && this.parent.has(key));
    };
    Scope.prototype.createChild = function () {
        return new Scope(this);
    };
    return Scope;
})();
exports.Scope = Scope;
