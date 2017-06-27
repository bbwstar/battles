
/* Contains all logic to interface with the IndexDB. */

const IDB_VERSION = 1;

function connectToIDB(name, version) {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(name, version);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(name,
                { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
            throw new Error('IndexDatabase blocked');
        };
    });
}

function operateOnIDB(name, IDB, operation, data) {
    return new Promise((resolve, reject) => {
        const transaction = IDB.transaction(name, 'readwrite');
        const store = transaction.objectStore(name);
        let request;
        switch (operation) {
            case 'GET':
                request = store.getAll();
                request.onsuccess = () => {
                    console.log('GET request.result length: ' + request.result.length);
                    return resolve(request.result);
                };
                request.onerror = () => reject(request.error);
                break;
            case 'PUT':
                console.log('Persist data to store length: '
                    + JSON.stringify(data).length);
                request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                break;
            case 'DELETE':
                request = store.delete(data.id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                break;
            default: console.warn('No operation performed on IDB');
        }
    });
}

async function operateWithIDB(store, operation, data) {
    let IDB;
    try {
        console.log('Trying to operate with IDB');
        IDB = await connectToIDB(store, IDB_VERSION);
        return await operateOnIDB(store, IDB, operation, data);
    }
    catch (exception) {
        console.error(exception);
    }
    finally {
        if (IDB) {
            console.log('Closing now IDB with close()');
            IDB.close();
        }
    }
}

module.exports = function Persist(storeName) {
    this.fromStorage = () => operateWithIDB(storeName, 'GET', null);
    this.toStorage = data => operateWithIDB(storeName, 'PUT', data);
    this.deleteFromStorage = data => operateWithIDB(storeName, 'DELETE', data);
};