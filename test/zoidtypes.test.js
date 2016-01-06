'use strict';
var test = require('tap').test;

var Types = require('../');

test('Unify terminal and variable', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const a = Types.createVariable('a');
  Types.unify(a, Int32);
  t.equal(a.actual, Int32.actual);

  const b = Types.createVariable('b');
  Types.unify(a, b);
  t.equal(b.actual, Int32.actual);
  t.equal(b.actual, a.actual);

  // Can unify again and it just does nothing.
  Types.unify(a, b);

  t.end();
});

test('Unify template and terminal', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const List = scope.registerTemplate('List', [ 'T' ]);
  const ListInt32 = List.create([Int32]);

  t.throws(() => Types.unify(ListInt32, Int32));
  t.end();
});

test('Unify template type instances', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const List = scope.registerTemplate('List', [ 'T' ]);
  const a = Types.createVariable('a');

  const ListA = List.create([a]);
  const ListInt32 = List.create([Int32]);

  Types.unify(ListA, ListInt32);
  t.equal('List<Int32>', '' + ListA);

  t.end();
});

test('Function, add function call', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const Add = scope.createFunctionType([Int32, Int32], Int32);
  const arg1 = Int32;
  const arg2 = Types.createVariable('a');
  const result = Types.createVariable('b');
  Types.unifyCall(Add, [arg1, arg2], result);

  t.equal(result.actual, Int32);
  t.equal(arg2.actual, Int32);

  t.end();
});

test('Function, wrong argument type', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');
  const Add = scope.createFunctionType([Int32, Int32], Int32);
  const result = Types.createVariable('b');

  t.throws(() =>
    Types.unifyCall(Add, [Int32, Float64], result));
  t.end();
});

test('Function, unknown type', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');
  const Add = Types.createVariable('add');
  const arg1 = Int32;
  const arg2 = Float64;
  const result = Types.createVariable();
  Types.unifyCall(Add, [arg1, arg2], result);

  t.equal('(Int32, Float64) -> \'0', '' + Add);
  t.end();
});

test('Nested call of unknown function', t => {
  const scope = Types.createScope();
  const Int32 = scope.registerTerminal('Int32');

  const T = Types.createVariable('T');
  const Id = scope.createFunctionType([T], T).seal();

  const Add = Types.createVariable('add');

  const Double = scope.createFunctionType([Int32], Int32);

  // - We know nothing about `add`.
  // - We know that id is ('a) -> 'a
  // - We know that double takes an Int32 and returns an Int32
  //
  // Example:
  //
  // ```
  // double(id(add(10, 15)))
  // ```
  //
  // We should be able to infer that add: (Int32, Int32) -> Int32

  const addResult = Types.createVariable();
  Types.unifyCall(Add, [Int32, Int32], addResult);

  const idResult = Types.createVariable();
  Types.unifyCall(Id, [addResult], idResult);

  const doubleResult = Types.createVariable();
  Types.unifyCall(Double, [idResult], doubleResult);

  t.equal('(Int32, Int32) -> Int32', '' + Add);

  t.end();
});

test('Function, two calls of identity', t => {
  const scope = Types.createScope();
  const a = Types.createVariable('a');
  const Id = scope.createFunctionType([a], a).seal();

  const Int32 = scope.registerTerminal('Int32');
  const Float64 = scope.registerTerminal('Float64');

  const intResult = Types.createVariable();
  Types.unifyCall(Id, [Int32], intResult);

  const floatResult = Types.createVariable();
  Types.unifyCall(Id, [Float64], floatResult);

  t.equal(intResult.actual, Int32);
  t.equal(floatResult.actual, Float64);

  t.end();
});
