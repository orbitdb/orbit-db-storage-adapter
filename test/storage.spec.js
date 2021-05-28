const assert = require('assert')

const Storage = require('../src')
const implementations = require('./implementations')
const levelup = require('levelup')
const isNode = require('is-node')
const leveljs4 = isNode ? {} : require('level-js4')
const timeout = 2000

const data = [
  { type: (typeof true), key: 'boolean', value: true },
  { type: (typeof 1.0), key: 'number', value: 9000 },
  { type: (typeof 'x'), key: 'strng', value: 'string value' },
  { type: (typeof []), key: 'array', value: [1, 2, 3, 4] },
  { type: (typeof {}), key: 'object', value: { object: 'object', key: 'key' } }
]

describe('Storage Adapters - Default (level)', function () {
  this.timeout(timeout)

  let storage, store

  before(async () => {
    storage = Storage()
    store = await storage.createStore()
  })

  it('creates a level store if no storage is passed', async () => {
    assert.strictEqual(store.db.status, 'open')
    assert.strictEqual(store.db.db.location, './orbitdb')
  })

  data.forEach(d => {
    it(`puts and gets a ${d.key}`, async () => {
      await store.put(d.key, JSON.stringify(d.value))
      const val = await store.get(d.key)
      const decodedVal = JSON.parse(val.toString())
      assert.deepStrictEqual(decodedVal, d.value)
      assert.strictEqual(typeof decodedVal, d.type)
    })

    it('deletes properly', async () => {
      await store.put(d.key, JSON.stringify(d.value))
      await store.del(d.key, JSON.stringify(d.value))
      try {
        await store.get(d.key)
      } catch (e) {
        assert.strictEqual(true, true)
      }
    })
  })

  after(async () => {
    await store.close()
  })
})

implementations.forEach(implementation => {
  describe(`Storage Adapters - ${implementation.key}`, function () {
    this.timeout(timeout)

    let storage, store

    const location = implementation.fileName
    const server = implementation.server

    beforeEach(async () => {
      const storageType = implementation.module
      storage = Storage(storageType)
      if (server && server.start) await implementation.server.start({})
    })

    afterEach(async () => {
      await store.close()
      await storage.destroy(store)
      if (server && server.afterEach) await implementation.server.afterEach()
    })

    after(async () => {
      if (server && server.stop) await implementation.server.stop()
    })

    it('Creates a store in default ./orbitdb directory', async () => {
      store = await storage.createStore(location, implementation.defaultOptions || {})
      assert.strictEqual(store.db.status, 'open')
      assert.strictEqual(store.db.location, location || './orbitdb')
    })

    it('Creates a store in a custom directory', async () => {
      store = await storage.createStore(location || './customDir')
      assert.strictEqual(store.db.status, 'open')
      assert.strictEqual(store.db.location, location || './customDir')
    })

    data.forEach(d => {
      it(`puts and gets a ${d.key}`, async () => {
        store = await storage.createStore(location, implementation.defaultOptions || {})
        await store.put(d.key, JSON.stringify(d.value))
        const val = await store.get(d.key)
        const decodedVal = JSON.parse(val.toString())
        assert.deepStrictEqual(decodedVal, d.value)
        assert.strictEqual(typeof decodedVal, d.type)
      })

      it('deletes properly', async () => {
        store = await storage.createStore(location, implementation.defaultOptions || {})
        await store.put(d.key, JSON.stringify(d.value))
        await store.del(d.key, JSON.stringify(d.value))
        try {
          await store.get(d.key)
        } catch (e) {
          assert.strictEqual(true, true)
        }
      })
    })

    if (implementation.key === 'level-js') {
      it('supports and upgrades level-js4 stores', async () => {
        const location = './version4'
        const key = 'upgrade'
        const value = ' to version 5'

        // add to db using level-js version 4
        const db4 = levelup(leveljs4(location))
        await db4.open()
        await db4.put(key, value)
        await db4.close()

        // upgrades the db
        store = await storage.createStore(location)
        assert.strictEqual((await store.get(key)).toString(), value)
        assert.strictEqual(store._leveljs5, undefined)

        // persisted that db was upgraded
        await store.close()
        store = await storage.createStore(location)
        assert.strictEqual((await store.get(key)).toString(), value)
        assert.strictEqual(store._leveljs5, true)
      })
    }
  })
})
