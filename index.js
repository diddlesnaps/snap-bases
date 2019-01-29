'use strict';

const config = require('./config');
const SnapApi = require('./api');

Promise.all(config.spider.snaps.stores.map(async (store) => {
    let api = new SnapApi(store.url, store.domain);
    const snaps = await api.list();

    const non_hello_or_test_snaps = snaps.reduce((carry, snap) => {
        const name = ('name' in snap) ? snap.name : '';
        if (name !== '' && !name.match(/^(hello|test)-/) && !name.match(/-test$/)) {
            carry = [...carry, snap];
        }
        return carry;
    }, []);

    const bases = non_hello_or_test_snaps.reduce((carry, snap) => {
        if ('base' in snap && snap.base !== '') {
            carry = [...carry, snap.base];
        }
        return carry;
    }, []);

    const found_base_names = [...new Set(bases)];

    console.log(`Found ${snaps.length} snaps of which ${bases.length} specified a base snap.`);
    console.log(`There are ${snaps.length - non_hello_or_test_snaps.length} snaps that match '*-test', 'test-*', and 'hello-*' leaving ${non_hello_or_test_snaps.length} in the set.`)
    console.log(`Base snap names found in non-hello and non-test snaps: ${found_base_names.join(', ')}.`);
    for (const name of found_base_names) {
        const this_base = bases.reduce((carry, base) => {
            if (base === name) {
                carry = [...carry, true];
            }
            return carry;
        }, []);
        console.log(`${this_base.length} non-hello and non-test snaps specified ${name} as their base snap.`);
    }
}));