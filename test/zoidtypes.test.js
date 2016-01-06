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
