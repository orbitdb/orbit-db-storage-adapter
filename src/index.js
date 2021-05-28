'use strict'

const levelup = require('levelup')
const level = require('level')
const reachdown = require('reachdown')
const fs = (typeof window === 'object' || typeof self === 'object') ? null : eval('require("fs")') // eslint-disable-line

// Should work for all abstract-leveldown compliant stores

/*
 * createIfMissing (boolean, default: true): If true, will initialise an empty database at the specified location if one doesn't already exist. If false and a database doesn't exist you will receive an error in your open() callback and your database won't open.
 *
 * errorIfExists (boolean, default: false): If true, you will receive an error in your open() callback if the database exists at the specified location.
 *
 * compression (boolean, default: true): If true, all compressible data will be run through the Snappy compression algorithm before being stored. Snappy is very fast and shouldn't gain much speed by disabling so leave this on unless you have good reason to turn it off.
 *
 * cacheSize (number, default: 8 * 1024 * 1024 = 8MB): The size (in bytes) of the in-memory LRU cache with frequently used uncompressed block contents.
 */

class Storage {
  constructor (storage, options = {}) {
    const defaults = {
      createIfMissing: true,
      errorIfExists: false,
      compression: true,
      cacheSize: 8 * 1024 * 1024
    }

    this.storage = storage
    this.preCreate = options.preCreate ? options.preCreate : () => {}

    const leveldownOptions = Object.assign({}, options, defaults)
    delete leveldownOptions.preCreate
    this.options = { down: leveldownOptions }
  }

  async createStore (directory = './orbitdb', options = {}) {
    this.options.up = options
    await this.preCreate(directory, this.options)
    let store, db

    if (this.storage) {
      db = this.storage(directory, this.options.down)

      // For compatibility with older abstract-leveldown stores
      if (!db.status) db.status = 'unknown-shim'
      if (!db.location) db.location = directory

      store = levelup(db, options)
      await new Promise((resolve, reject) => {
        store.open((err) => {
          if (err) {
            return reject(err)
          }

          // More backwards compatibility
          if (db && db.status === 'unknown-shim') db.status = 'open'
          resolve(store)
        })
      })
    } else {
      // Default leveldown or level-js store with directory creation
      if (fs && fs.mkdirSync) fs.mkdirSync(directory, { recursive: true })
      db = level(directory, options)
      await db.open()
    }

    store = store || db
    const leveljs = store && reachdown(store, 'level-js', true)
    if (leveljs && leveljs.upgrade) {
      await this._leveljsUpgrade(store, leveljs)
    }

    return store
  }

  // upgrade level-js to version 5.0.0
  // https://github.com/Level/level-js/blob/master/UPGRADING.md#500
  async _leveljsUpgrade (store, leveljs) {
    const upgradeKey = new Uint8Array([0])

    async function isUpgraded () {
      return Boolean(await store.get(upgradeKey).catch(e => false))
    }
    async function setUpgraded () {
      await store.put(upgradeKey, '1')
    }

    // return if already upgraded
    if (await isUpgraded()) {
      store._leveljs5 = true
      return
    }

    // upgrade store and persist that it was upgraded
    await new Promise((resolve, reject) => {
      leveljs.upgrade(function (err) {
        if (err) reject(err)
        else resolve()
      })
    })
    await setUpgraded()
  }

  destroy (store) {
    return new Promise((resolve, reject) => {
      // TODO: Clean this up
      if (!this.storage.destroy) resolve()

      this.storage.destroy(store._db.location, (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  async preCreate (directory, options) {} // to be overridden
}

module.exports = (storage, options) => new Storage(storage, options)
