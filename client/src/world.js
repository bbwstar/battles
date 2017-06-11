/*
 * Contains objects related to the game world in Battles. This includes areas,
 * dungeons, dungeon branches etc.
 */

var RG = require('./rg.js');

const Stairs = RG.Element.Stairs;

RG.World = {};

/* Branch, as name suggests, is a branch of dungeon. A branch is linear
 * progression of connected levels (usually with increasing difficulty).
 * Branch can have
 * entry points to other branches (or out of the dungeon). */
RG.World.Branch = function(name) {

    var _name = name;
    this.getName = function() {return _name;};

    var _levels = [];

    var _stairsDown = [];
    var _stairsUp = [];
    var _stairsOther = [];

    var _numCount = 1;

    var _dungeon = null;

    /* Sets/gets the dungeon where this branch is located. */
    this.setDungeon = function(dungeon) {_dungeon = dungeon;};
    this.getDungeon = function() {return _dungeon;};

    this.getLevels = function() {return _levels;};
    this.getStairsUp = function() {return _stairsUp;};
    this.getStairsDown = function() {return _stairsDown;};

    /* Stairs leading to other branches.*/
    this.getStairsOther = function() {return _stairsOther;};

    /* Returns entrance/exit for the branch.*/
    this.getEntrance = function() {
        return _stairsUp[0];
    };

    /* Connects entrance to a stairs.*/
    this.connectEntrance = function(stairs) {
        if (_stairsUp.length > 0) {
            _stairsUp[0].setTargetStairs(stairs);
        }
        else {
            RG.err('World.Branch', 'connectEntrance',
                'No stairs for connection exist. Call connectLevels() first.');
        }
    };

    /* Connects specified level to the given stairs (Usually external to this
     * branch.*/
    this.connectLevelToStairs = function(nLevel, stairs) {
        var level = _levels[nLevel];
        var otherBranchLevel = stairs.getSrcLevel();

        if (!RG.isNullOrUndef([otherBranchLevel])) {
            var down = !stairs.isDown();
            var newStairs = new Stairs(down,
                level, otherBranchLevel);
            var cell = level.getFreeRandCell();
            level.addStairs(newStairs, cell.getX(), cell.getY());
            newStairs.setTargetStairs(stairs);
            _stairsOther.push(newStairs);
        }
        else {
            RG.err('World.Branch', 'connectLevelToStairs',
                'Stairs must be first connected to other level.');
        }
    };

    this.hasLevel = function(level) {
        var index = _levels.indexOf(level);
        return index >= 0;
    };

    this.addLevel = function(level) {
        if (!this.hasLevel(level)) {
            level.setLevelNumber(_numCount++);
            _levels.push(level);
        }
        else {
            RG.err('World.Branch', 'addLevel',
                'Trying to add existing level. ');
        }
    };

    /* Connects the added levels together.*/
    this.connectLevels = function() {
        var nLevels = _levels.length;
        for (let nl = 0; nl < nLevels; nl++) {
            var src = _levels[nl];
            var stairCell = null;

            // Create stairs down
            if (nl < nLevels - 1) {
                var targetDown = _levels[nl + 1];
                var stairsDown = new Stairs(true, src, targetDown);
                stairCell = src.getFreeRandCell();
                src.addStairs(stairsDown, stairCell.getX(), stairCell.getY());
                _stairsDown.push(stairsDown);
            }

            // Create stairs up
            if (nl >= 0) {
                var targetUp = _levels[nl - 1];
                var stairsUp = new Stairs(false, src, targetUp);
                stairCell = src.getFreeRandCell();
                src.addStairs(stairsUp, stairCell.getX(), stairCell.getY());
                _stairsUp.push(stairsUp);
            }
        }

        // Finally connect the stairs together
        for (let nl = 0; nl < nLevels; nl++) {
            if (nl < nLevels - 1) {
                _stairsDown[nl].setTargetStairs(_stairsUp[nl + 1]);
            }

            // Don't connect first stairs up
            if (nl > 0) {
                _stairsUp[nl].setTargetStairs(_stairsDown[nl - 1]);
            }
        }
    };

};

/* Dungeons is a collection of branches.*/
RG.World.Dungeon = function(name) {

    var _name = name;
    this.getName = function() {return _name;};

    var _branches = [];

    /* Returns true if the dungeon has given branch.*/
    this.hasBranch = function(branch) {
        var index = _branches.indexOf(branch);
        return index >= 0;
    };

    /* Adds one branch to the dungeon. Returns true if OK. */
    this.addBranch = function(branch) {
        if (!this.hasBranch(branch)) {
            _branches.push(branch);
            branch.setDungeon(this);
            return true;
        }
        return false;
    };

    /* Get all levels for this dungeon. */
    this.getLevels = function() {
        let res = [];
        for (let i = 0; i < _branches.length; i++) {
            res = res.concat(_branches[i].getLevels());
        }
        return res;
    };

    /* Returns all entrances/exits for the dungeon.*/
    this.getEntrances = function() {
        const res = [];
        for (let i = 0; i < _branches.length; i++) {
            res.push(_branches[i].getEntrance());
        }
        return res;
    };

    /* Connects two branches b1 and b2 together from specified level
     * numbers l1 and l2. */
    this.connectBranches = function(b1, b2, l1, l2) {
        if (this.hasBranch(b1) && this.hasBranch(b2)) {
            var down = true;
            if (l1 > l2) {down = false;}
            var stairs = new Stairs(down);
            var b2Levels = b2.getLevels();
            if (l2 < b2Levels.length) {
                var cell = b2Levels[l2].getFreeRandCell();
                b2Levels[l2].addStairs(stairs, cell.getX(), cell.getY());
                b1.connectLevelToStairs(l1, stairs);
            }
            else {
                RG.err('World.Dungeon', 'connectBranches',
                    'Level ' + l2 + " doesn't exist in branch " + b2.getName());
            }
        }
        else {
            RG.err('World.Dungeon', 'connectBranches',
                'Branches must be added to dungeon before connection.');
        }
    };

};

/* Area-tile is a level which has entry/exit points on a number of edges.*/
RG.World.AreaTile = function(x, y, area) {

    var _tileX = x;
    var _tileY = y;
    var _area = area;

    this.cols = null;
    this.rows = null;

    var _level = null;

    /* Sets the level for this tile.*/
    this.setLevel = function(level) {
        _level = level;
        this.cols = _level.getMap().cols;
        this.rows = _level.getMap().rows;
    };

    this.getLevel = function() {return _level;};

    this.getLevel = function() {return _level;};
    this.getTileX = function() {return _tileX;};
    this.getTileY = function() {return _tileY;};

    /* Returns true for edge tiles.*/
    this.isEdge = function() {
        if (this.isNorthEdge()) {return true;}
        if (this.isSouthEdge()) {return true;}
        if (this.isWestEdge()) {return true;}
        if (this.isEastEdge()) {return true;}
        return false;
    };

    this.isNorthEdge = function() {return _tileY === 0;};
    this.isSouthEdge = function() {return _tileY === (_area.getMaxY() - 1);};
    this.isWestEdge = function() {return _tileX === 0;};
    this.isEastEdge = function() {return _tileY === (_area.getMaxY() - 1);};

    /* Connect this tile to east and south tiles */
    this.connect = function(eastTile, southTile) {
        var lastX = this.cols - 1;
        var lastY = this.rows - 1;

        // Connect to east tile
        if (!RG.isNullOrUndef([eastTile])) {
            var levelEast = eastTile.getLevel();
            const map = _level.getMap();
            var mapEast = levelEast.getMap();

            for (var y = 1; y <= lastY - 1; y++) {
                const cell = map.getCell(lastX, y);
                var cellEast = mapEast.getCell(0, y);

                if (cell.isFree() && cellEast.isFree()) {
                    const stairs = new Stairs(true, _level, levelEast);
                    var stairsEast = new Stairs(false, levelEast, _level);
                    stairs.setTargetStairs(stairsEast);
                    stairsEast.setTargetStairs(stairs);

                    _level.addStairs(stairs, lastX, y);
                    levelEast.addStairs(stairsEast, 0, y);
                }
            }

        }

        // Connect to south tile
        if (!RG.isNullOrUndef([southTile])) {
            var levelSouth = southTile.getLevel();
            const map = _level.getMap();
            var mapSouth = levelSouth.getMap();

            for (var x = 1; x <= lastX - 1; x++) {
                const cell = map.getCell(x, lastY);
                var cellSouth = mapSouth.getCell(x, 0);

                if (cell.isFree() && cellSouth.isFree()) {
                    const stairs = new Stairs(true, _level, levelSouth);
                    var stairsSouth = new Stairs(false, levelSouth, _level);
                    stairs.setTargetStairs(stairsSouth);
                    stairsSouth.setTargetStairs(stairs);
                    _level.addStairs(stairs, x, lastY);
                    levelSouth.addStairs(stairsSouth, x, 0);
                }
            }
        }
    };
};

/* Area is N x M area of tiles, with no linear progression like in dungeons.
 * Moving between tiles of areas happens by travelling to the edges of a tile.
 * Each tile is a level with special edge tiles.
 * */
RG.World.Area = function(name, maxX, maxY) {

    var _name = name;
    this.getName = function() {return _name;};

    var _maxX = maxX;
    var _maxY = maxY;

    this.getMaxX = () => (_maxX);
    this.getMaxY = () => (_maxY);
    const _tiles = [];

    this._init = function() {
        // Create the tiles
        for (let x = 0; x < _maxX; x++) {
            const tileColumn = [];
            for (let y = 0; y < _maxY; y++) {
                const newTile = new RG.World.AreaTile(x, y, this);
                // const level = RG.FACT.createLevel('ruins', 30, 30, {});
                const levelConf = {
                    forest: {
                        ratio: 0.5,
                        shape: 'cellular'
                    }
                };
                const level = RG.FACT.createLevel('forest', 30, 30, levelConf);
                newTile.setLevel(level);
                tileColumn.push(newTile);
            }
            _tiles.push(tileColumn);
        }

        // Connect the tiles
        for (let x = 0; x < _maxX; x++) {
            for (let y = 0; y < _maxY; y++) {
                if (x < _maxX - 1 && y < _maxY - 1) {
                    _tiles[x][y].connect(_tiles[x + 1][y], _tiles[x][y + 1]);
                }
                else if (x < _maxX - 1) {
                    _tiles[x][y].connect(_tiles[x + 1][y], null);
                }
                else if (y < _maxY - 1) {
                    _tiles[x][y].connect(null, _tiles[x][y + 1]);
                }
            }
        }
    };

    this._init();

    this.getMaxX = function() {return _maxX;};
    this.getMaxY = function() {return _maxY;};

    this.getLevels = function() {
        var res = [];
        for (let x = 0; x < _tiles.length; x++) {
            for (let y = 0; y < _tiles[x].length; y++) {
                res.push(_tiles[x][y].getLevel());
            }
        }
        return res;
    };

    this.getTiles = function() {
        return _tiles;
    };

};

/* Mountains places consisting of tiles and dungeons. Mountain has few special
 * tiles representing the summit.
 */
RG.World.Mountain = function() {
    const _levels = [];

    this.getLevels = () => (_levels);

};

/* Factory object for creating worlds and features. */
RG.World.Factory = function() {

    this.createArea = function(conf) {
        const area = new RG.World.Area('testArea', 4, 4);
        console.log('Conf is ' + conf);
        return area;
    };

    this.createBranch = function() {
        const branch = new RG.World.Branch('testBranch');
        for (let i = 0; i < 5; i++) {
            const level = RG.FACT.createLevel('cellular', 30, 30, {});
            branch.addLevel(level);
        }
        branch.connectLevels();
        return branch;
    };

    this.createDungeon = function(conf) {
        const dungeon = new RG.World.Dungeon('testDungeon');
        const branch = this.createBranch();
        dungeon.addBranch(branch);
        console.log('Conf is ' + conf);
        return dungeon;
    };

    this.createMountain = function(conf) {
        const mountain = new RG.World.Mountain();
        console.log('Conf is ' + conf);
        return mountain;
    };

    /* Creates a connection between an area and a feature such as city, mountain
     * or dungeon. Unless configured, connects the feature entrance to a random
     * location in the area. */
    this.createConnection = function(area, feature) {
        // const areaMaxX = area.getMaxX();
        // const areaMaxY = area.getMaxY();
        const tile00 = area.getTiles()[0][0];
        const tileLevel = tile00.getLevel();

        const freeAreaCell = tileLevel.getFreeRandCell();
        const freeX = freeAreaCell.getX();
        const freeY = freeAreaCell.getY();

        if (feature.hasOwnProperty('getEntrances')) {
            const entrances = feature.getEntrances();
            if (entrances.length > 0) {
                const entranceStairs = entrances[0];
                const entranceLevel = entranceStairs.getSrcLevel();
                const tileStairs = new Stairs(true, tileLevel, entranceLevel);
                tileStairs.setTargetStairs(entranceStairs);
                entranceStairs.setTargetStairs(tileStairs);
                entranceStairs.setTargetLevel(tileLevel);
                tileLevel.addStairs(tileStairs, freeX, freeY);
                console.log(`Created tile stairs at ${freeX}, ${freeY}`);
            }
            else {
                RG.err('World.Factory', 'createConnection',
                    'Zero entrances in feature. Cannot connect to tile.');

            }
        }
        else { // No entrance for feature, what to do?
            console.warn('No getEntrance method for feature. Skipping connect');
        }
    };
};

/* Largest place. Contains a number of areas, mountains and dungeons. */
RG.World.World = function(conf) {
    if (RG.isNullOrUndef([conf])) {
        RG.err('World.World', '', 'No configuration given.');
        return;
    }

    var _fact = new RG.World.Factory();

    const _allLevels = {}; // Lookup table for all levels
    const _areas = [];
    const _dungeons = [];
    const _mountains = [];

    const nAreas = conf.nAreas;
    const nDungeonsPerArea = conf.nDungeonsPerArea;
    const nMountainsPerArea = conf.nMountainsPerArea;

    /* Adds the array of levels to the global map. */
    this.addLevels = function(levels) {
        levels.forEach(level => {
            const id = level.getID();
            if (!_allLevels.hasOwnProperty(id)) {
                _allLevels[id] = level;
            }
            else {
                RG.err('World.World', 'addLevels',
                    `Level ID ${id} already exists.`);
            }
        });
    };

    this.getLevels = function() {
        return Object.keys(_allLevels).map(key => _allLevels[key]);
    };

    for (let n = 0; n < nAreas; n++) {
        const area = _fact.createArea(conf);
        _areas.push(area);
        this.addLevels(area.getLevels());

        for (let n = 0; n < nDungeonsPerArea; n++) {
            const dungeon = _fact.createDungeon(conf);
            _dungeons.push(dungeon);
            this.addLevels(dungeon.getLevels());
            _fact.createConnection(area, dungeon);
        }

        for (let n = 0; n < nMountainsPerArea; n++) {
            const mountain = _fact.createMountain(conf);
            _mountains.push(mountain);
            this.addLevels(mountain.getLevels());
            _fact.createConnection(area, mountain);
        }
    }

    this.getAreas = () => (_areas);
    this.getDungeons = () => (_dungeons);
    this.getMountains = () => (_mountains);

    // Connect areas and dungeons

};


module.exports = RG.World;
