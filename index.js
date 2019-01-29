'use strict';

const config = require('./config');
const SnapApi = require('./api');

Promise.all(config.spider.snaps.stores.map(async (store) => {
    let api = new SnapApi(store.url, store.domain);
    const snaps = await api.list();

    const bases = snaps.reduce((carry, snap) => {
        if ('base' in snap && snap.base !== '') {
            carry = [...carry, snap.base];
        }
        return carry;
    }, []);

    const found_base_names = [...new Set(bases)];

    console.log(`Found ${snaps.length} snaps of which ${bases.length} specified a base snap.`);
    console.log(`Base snap names found: ${found_base_names.join(', ')}.`);
    for (const name of found_base_names) {
        const this_base = bases.reduce((carry, base) => {
            if (base === name) {
                carry = [...carry, true];
            }
            return carry;
        }, []);
        console.log(`${this_base.length} snaps specified ${name} as their base snap.`);
    }
}));