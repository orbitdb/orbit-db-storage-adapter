'use strict'

const levelup = require('levelup')

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
  constructor (storage, options = {
    createIfMissing: true,
    errorIfExists: false,
    compression: true,
    cacheSize: 8 * 1024 * 1024 }
  ) {
    this.storage = storage
    this.options = { down: options }
  }

  createStore (directory = './orbitdb', options = {}) {
    return new Promise((resolve, reject) => {
      this.options.up = options
      this.preCreate(directory, this.options).then(() => {
        const db = this.storage(directory, this.options.down)

        // For compatibility with older abstract-leveldown stores
        if (!db.status) db.status = 'unknown-shim'
        if (!db.location) db.location = directory

        const store = levelup(db, options)
        store.open((err) => {
          if (err) {
            return reject(err)
          }
          // More backwards compatibility
          if (db.status === 'unknown-shim') db.status = 'open'
          resolve(store)
        })
      })
    })
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
