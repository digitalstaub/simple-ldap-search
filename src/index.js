/**
* A simple LDAP query machine
*/
import ldap from 'ldapjs';
import Promise from 'bluebird';
import cleanEntry from './lib/cleanEntry';

export default class SimpleLDAPGet {
  constructor({ url, base, dn, password }) {
    this.config = { url, base, dn, password };
    this.client = ldap.createClient({ url });
    this.isBoundTo = null;
    this.isBinding = false;
    this.queue = [];
  }

  /**
   * destroys the ldap client
   */
  destroy() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.isBoundTo = null;
  }

  bindDN() {
    const self = this;
    const { dn, password } = this.config;

    return new Promise((resolve, reject) => {
      if (!dn || !password) {
        return reject('No bind credentials provided');
      }

      if (this.isBoundTo === dn) {
        return resolve();
      }

      if (this.isBoundTo && this.isBoundTo !== dn) {
        return reject(`bound to different dn: ${dn}`);
      }

      if (this.isBinding) {
        return this.client.on('isBound', resolve);
      }

      self.isBinding = true;
      return this.client.bind(dn, password, (err, res) => {
        if (err) return reject(err);

        self.isBinding = false;
        self.isBoundTo = dn;

        // emit a bind message on success
        // signalling to any other client
        // that tried to bind that we're ready
        self.client.emit('isBound');
        return resolve(res);
      });
    });
  }

  /**
   * searches ldap. Will autobind if
   * this.config.dn and this.config.password are set.
   */
  async search(filter = '(objectclass=*)', attributes) {
    const self = this;
    const opts = {
      scope: 'sub',
      filter,
      attributes,
    };
    const results = [];

    // bind if not bound
    try {
      await self.bindDN();
    } catch (err) {
      Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      self.client.search(self.config.base, opts, (err, res) => {
        if (err) {
          return reject(`search failed ${err.message}`);
        }

        return res
          .on('searchEntry', entry => (
            results.push(cleanEntry(entry.object))
          ))
          .on('error', resError => (
            reject(`search Error: ${resError}`)
          ))
          .on('end', () => resolve(results));
      });
    });
  }
}

//   async bindToDN({ dn, password }) {
//     // resolve immediately if we've already bound to this dn
//     if (this.isBoundTo === dn) return;

//     try {
//       await this.client.bindAsync(dn, password);
//     } catch (err) {
//       throw err;
//     }
//     this.isBoundTo = dn;
//   }

//   search(filter = '(objectclass=*)', attributes) {
//     const self = this;

//     const opts = {
//       filter,
//       scope: 'sub',
//       attributes,
//     };


//     return new Promise((resolve, reject) => {
//       self.client.search(self.config.base, opts, (err, res) => {
//         if (err) return reject(err);

//         const results = [];
//         res.on('searchEntry', (entry) => {
//           results.push(cleanEntry(entry.object));
//         });

//         res.on('error', (resError) => {
//           throw resError;
//         });

//         res.on('end', () => {
//           resolve(results);
//         });
//       });
//     });
//   }

//   destroy() {
//     if (this.client) {
//       this.client.destroy();
//       this.client = null;
//     }
//     this.isBoundTo = null;
//   }
// }
