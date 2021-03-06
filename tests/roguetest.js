
/** Note: This file doesn't contain any unit tests. It has some architecture for
 * performing common test function.*/

const RG = require('../client/src/battles');
const expect = require('chai').expect;

const RGTest = {};

RGTest.rng = new RG.Random();

/* Creates a mock-level for unit tests. */
RGTest.createMockLevel = function(cols, rows) {
    const level = {cols: cols, rows: rows,
        map: {
            getCell: function(x, y) {
                return { x: x, y: y };
            },
            hasXY: function() {
                return true;
            },
            isPassable: function(x, y) {
                return x > -1 && y > -1;
            }
        },
        getMap: function() {return this.map;},

        addActor: function(actor, x, y) {
            actor.setXY(x, y);
            actor.setLevel(this);
        }
    };
    return level;
};

RGTest.createLevel = function(type, cols, rows) {
    return RG.FACT.createLevel('arena', cols, rows);
};

RGTest.equipItem = function(actor, item) {
    const invEq = actor.getInvEq();
    invEq.addItem(item);
    expect(invEq.equipItem(item)).to.equal(true);
};

/* Wraps an object into a cell for later use. Some functions require a map cell
* instead of taking the object directly, so this is useful. */
RGTest.wrapObjWithCell = function(obj) {
    const cell = RG.FACT.createFloorCell();
    cell.setExplored(true); // Otherwise returns darkness
    const propType = obj.getPropType();
    cell.setProp(propType, obj);
    return cell;
};

RGTest.getMeAWizard = function(conf = {}) {
    const wizard = new RG.Actor.Rogue('wizard');
    wizard.setType(conf.type || 'human');
    const brain = new RG.Brain.SpellCaster(wizard);
    wizard.setBrain(brain);

    wizard._spellbook = new RG.Spell.SpellBook(wizard);
    const spell = RG.FACT.createSpell('FrostBolt');
    spell.setPower(conf.power || 11);
    spell.setRange(conf.range || 7);
    spell.setDice([RG.FACT.createDie([1, 2, 3])]);
    wizard._spellbook.addSpell(spell);

    const spellPower = new RG.Component.SpellPower();
    spellPower.setPP(30);
    spellPower.setMaxPP(40);
    wizard.add('SpellPower', spellPower);
    return wizard;

};

RGTest.checkActorXY = function(actor, x, y) {
    expect(actor.getX(), `X must be ${x}`).to.equal(x);
    expect(actor.getY(), `Y must be ${y}`).to.equal(y);
};

RGTest.checkChar = function(obj, expChar) {
    const cell = RGTest.wrapObjWithCell(obj);
    expect(RG.getCellChar(cell)).to.equal(expChar);
};

RGTest.checkCSSClassName = function(obj, expClass) {
    const cell = RGTest.wrapObjWithCell(obj);
    expect(RG.getStyleClassForCell(cell)).to.equal(expClass);

};

RGTest.expectEqualHealth = function(o1, o2) {
    expect(o1.get('Health').getHP()).to.equal(o2.get('Health').getHP());
};

RGTest.verifyStairsConnectivity = function(stairs) {
    let connVerified = 0;
    stairs.forEach(s => {
        expect(s.getTargetStairs()).not.to.be.empty;
        expect(s.getTargetLevel()).not.to.be.empty;
        expect(s.getSrcLevel()).not.to.be.empty;
        ++connVerified;
    });
    console.log(`verifyStairsConnectivity ${connVerified} connections OK`);
};

// Expect that branches b1 and b2 are connected by number of connections
// given by nConns.
RGTest.expectConnected = function(b1, b2, nConns) {
    let connFound = 0;
    const b1Stairs = b1.getStairsOther();
    const b2Stairs = b2.getStairsOther();
    expect(b1Stairs, 'B1 must have stairs').to.have.length.above(0);
    expect(b2Stairs, 'B2 must have stairs').to.have.length.above(0);

    b1Stairs.forEach(stair1 => {
        const s1TargetID = stair1.getTargetLevel().getID();
        expect(stair1.getTargetStairs()).not.to.be.empty;
        b2Stairs.forEach(stair2 => {
            const s2SourceID = stair2.getSrcLevel().getID();
            if (s1TargetID === s2SourceID) {
                // stair1 should be the target of stair2
                if (stair2.getTargetStairs() === stair1) {
                    ++connFound;
                }
                expect(stair2.getTargetStairs()).not.to.be.empty;
            }
        });
    });
    expect(connFound, `Connections between branches must be ${nConns}`)
        .to.equal(nConns);
};

/* Adds each entity into the level. */
RGTest.wrapIntoLevel = function(arr) {
    const level = RG.FACT.createLevel('empty', 20, 20);
    arr.forEach(ent => {
        const x = RGTest.rng.getUniformInt(0, 19);
        const y = RGTest.rng.getUniformInt(0, 19);
        if (ent.getPropType() === RG.TYPE_ACTOR) {
            level.addActor(ent, x, y);
        }
        if (ent.getPropType() === RG.TYPE_ITEM) {
            level.addItem(ent, x, y);
        }
    });
    return level;
};

/* Moves entity from its current position to x,y. */
RGTest.moveEntityTo = function(ent, x, y) {
    const map = ent.getLevel().getMap();
    const xOld = ent.getX();
    const yOld = ent.getY();
    const propType = ent.getPropType();
    if (map.removeProp(xOld, yOld, propType, ent)) {
        map.setProp(x, y, propType, ent);
        ent.setXY(x, y);
        return true;
    }
    throw new Error(`Cannot move entity to ${x}, ${y}`);
};

/* Equips all given items for the given actor, and checks that everything
 * succeeds. */
RGTest.equipItems = function(ent, items) {
    const inv = ent.getInvEq();
    items.forEach(item => {
        inv.addItem(item);
        if (!inv.equipItem(item)) {
            throw new Error(`Cannot equip item ${item}`);
        }
    });
};

module.exports = RGTest;
