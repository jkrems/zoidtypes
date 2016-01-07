var types_1 = require('./types');
var unify_1 = require('./unify');
var clone_1 = require('./clone');
var scope_1 = require('./scope');
var unify_2 = require('./unify');
exports.unify = unify_2.unify;
var clone_2 = require('./clone');
exports.seal = clone_2.seal;
exports.unseal = clone_2.unseal;
/* END: ES6 Map */
function createScope() {
    return new scope_1.Scope();
}
exports.createScope = createScope;
function createVariable(name) {
    return new types_1.TypeVariable(name);
}
exports.createVariable = createVariable;
function createConstraint(name) {
    return new types_1.TypeConstraint(name);
}
exports.createConstraint = createConstraint;
function unifyCall(a, args, result) {
    args = args.slice(0);
    var b = types_1.FUNCTION.create([args.pop(), result]);
    while (args.length) {
        b = types_1.FUNCTION.create([args.pop(), b]);
    }
    return unify_1.unify(clone_1.unseal(a), b);
}
exports.unifyCall = unifyCall;
