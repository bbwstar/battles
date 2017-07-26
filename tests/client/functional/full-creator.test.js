
const expect = require('chai').expect;
const RG = require('../../../client/src/battles');

const Creator = require('../../../client/src/world.creator');

describe('Creator + Factory', function() {
    this.timeout(60000);
    it('description', () => {

        const conf = {
            name: 'My World',
            worldSize: 'Small',
            areaSize: 'Small'
        };
        const creator = new Creator();
        const worldConf = creator.createWorldConf(conf);

        const worldFact = new RG.Factory.World();
        const world = worldFact.createWorld(worldConf);

        expect(world.getName()).to.equal('My World');
        expect(world.getAreas()).to.have.length(1);
    });
});