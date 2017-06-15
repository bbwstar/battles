
/* Contains unit tests for Map.Level. */

const expect = require('chai').expect;
const RG = require('../../../client/src/battles');
const RGTest = require('../../roguetest.js');

const Actor = RG.Actor.Rogue;
const Level = RG.Map.Level;
const Element = RG.Element.Base;
const Cell = RG.Map.Cell;
const Item = RG.Item.Base;
const Container = RG.Item.Container;
const InvAndEquip = RG.Inv.Inventory;
const Factory = RG.FACT;
const Stairs = RG.Element.Stairs;

RG.cellRenderArray = RG.cellRenderVisible;


describe('Map.Level', () => {
    it('has unique ID and level number', () => {
        const level1 = new Level();
        const level2 = new Level();
        expect(level1.getID()).not.to.equal(level2.getID());

        level1.setLevelNumber(10);
        expect(level1.getLevelNumber()).to.equal(10);
    });

    it('It has a list of map cells', () => {
        const level1 = RGTest.createLevel('arena', 20, 20);
        expect(level1.getMap()).to.not.be.empty;

        const freeCell = level1.getFreeRandCell();
        expect(freeCell).to.not.be.empty;

        const emptyCell = level1.getEmptyRandCell();
        expect(emptyCell).to.not.be.empty;
    });

    it('has actors', () => {
        const level1 = RGTest.createLevel('arena', 20, 20);
        const actor = new Actor('actor');
        level1.addActor(actor, 2, 2);

        let actors = level1.getActors();
        expect(actors).to.have.length(1);
        expect(actors[0].getID()).to.equal(actor.getID());

        level1.removeActor(actor);
        actors = level1.getActors();
        expect(actors).to.have.length(0);
    });

    it('has items', () => {
        const level1 = RGTest.createLevel('arena', 20, 20);
        const item1 = new Item('item1');
        const item2 = new Item('item2');
        expect(level1.addItem(item1, 2, 2)).to.be.true;
        expect(level1.addItem(item2, 3, 3)).to.be.true;

        let items = level1.getItems();
        expect(items).to.have.length(2);
        expect(items[0]).to.equal(item1);

        expect(level1.removeItem(item1, 2, 2)).to.be.true;
        expect(level1.removeItem(item1, 2, 2)).to.be.false;

        items = level1.getItems();
        expect(items).to.have.length(1);
        expect(items[0]).to.equal(item2);
    });

    it('has stairs', () => {
        const level1 = RGTest.createLevel('arena', 20, 20);
        const level2 = RGTest.createLevel('arena', 20, 20);
        const stairs = new Stairs(true, level1, level2);
        level1.addStairs(stairs, 5, 5);

        let sList = level1.getStairs();
        expect(sList).to.have.length(1);

        // level1._removePropFromLevelXY(RG.TYPE_ELEM, stairs, 5, 5);
        // sList = level1.getStairs();
        // expect(sList).to.have.length(0);
    });

});
