'use strict';

const axios = require('axios');

const config = require('./config');

class SnapApi {
    constructor(url, domain) {
        this.url = url;
        this.domain = domain;
    }

    async listArch(url, arch, section, results) {
        results = results ? results : [];

        let headers = {'User-Agent': config.spider.snaps.user_agent};
        if (arch) {
            headers['X-Ubuntu-Architecture'] = arch;
        }

        let res = await axios({
            method: 'get',
            url: url,
            headers: headers
        })

        // logger.debug(`got package list page: ${url} (${arch}, ${section})`);

        if (res.data && res.data._embedded && res.data._embedded['clickindex:package']) {
            results = results.concat(res.data._embedded['clickindex:package'].map((snap) => {
                snap.section = section;
                return snap;
            }));
        }

        if (res.data._links && res.data._links.next && res.data._links.next.href) {
            let url = res.data._links.next.href;

            // Not sure why these links are coming back so weird, but this fixes it
            url = url.replace('http://snapdevicegw_cached', this.domain);
            url = url.replace('https://snapdevicegw_cached', this.domain);

            return this.listArch(url, arch, section, results);
        }
        else {
            return results;
        }
    }

    async searchList() {
        let url = `${this.url}/search?size=${config.spider.snaps.page_size}&confinement=strict,devmode,classic`;
        let promises = config.spider.snaps.architectures.map((arch) => {
            return this.listArch(url, arch, null);
        });
        promises.unshift(this.listArch(url, null, null));

        const results = await Promise.all(promises);
        let snapMap = {};
        let arch = 'all';
        let index = 0;
        results.forEach((list) => {
            // logger.debug(`total packages (${arch}): ${list.length}`);
            list.forEach((snap) => {
                snap.architecture = (snap.architecture) ? snap.architecture : [arch];
                if (!snapMap[snap.package_name]) {
                    snapMap[snap.package_name] = snap;
                }
                else {
                    let arches = snap.architecture.concat(snapMap[snap.package_name].architecture);
                    arches = arches.filter((value, index_1, self) => {
                        return self.indexOf(value) === index_1;
                    });
                    if (arches.indexOf('all') > -1) {
                        arches = ['all'];
                    }
                    if (snap.revision > snapMap[snap.package_name].revision) {
                        snapMap[snap.package_name] = snap;
                    }
                    snapMap[snap.package_name].architecture = arches;
                }
            });
            if (index < config.spider.snaps.architectures.length) {
                arch = config.spider.snaps.architectures[index];
                index++;
            }
        });
        let snaps = [];
        for (let name in snapMap) {
            snaps.push(snapMap[name]);
        }
        // logger.debug(`total packages: ${snaps.length}`);
        return snaps;
    }

    async list() {
        const results = await Promise.all([
            this.searchList(),
            this.searchSectionList(),
        ]);
        let searchResults = results[0];
        let sectionResults = results[1];
        searchResults.forEach((searchResult) => {
            searchResult.sections = sectionResults.filter((sectionResult) => {
                return (sectionResult.package_name == searchResult.package_name);
            }).map((sectionResult) => {
                return sectionResult.section;
            });
        });
        return searchResults;
    }

    async detailsArch(url, arch, series) {
        let headers = {
            'User-Agent': config.spider.snaps.user_agent,
            'X-Ubuntu-Series': series,
        };

        if (arch && arch != 'all') {
            headers['X-Ubuntu-Architecture'] = arch;
        }

        const res = await axios({
            method: 'get',
            url: url,
            headers: headers
        });
        
        return res.data;
    }

    async details(packageName, arches, sections, series) {
        // logger.debug('getting details for ' + packageName);

        let url = `${this.url}/details/${packageName}`;
        let promises = arches.map((arch) => {
            return this.detailsArch(url, arch, series).catch(() => {
                // logger.error(`Failed getting details of snap "${packageName}:${arch}"`);
                return null;
            });
        });

        const results = await Promise.all(promises);
        let snap = null;
        let downloads = {};
        results.forEach((result) => {
            if (result) {
                if (!snap || result.revision > snap.revision) {
                    snap = result;
                }
                if (result.anon_download_url) {
                    downloads[result.architecture[0]] = result.anon_download_url;
                }
            }
        });
        if (snap) {
            snap.downloads = downloads;
            snap.architecture = arches;
            snap.sections = sections;
        }
        return snap;
    }

    async sections() {
        let url = `${this.url}/sections`;
        let headers = {
            'User-Agent': config.spider.snaps.user_agent,
        };

        const res = await axios({
            method: 'get',
            url: url,
            headers: headers,
        });

        return res.data._embedded['clickindex:sections'];
    }

    async searchSectionList() {
        const sections = await this.sections();
        const sectionResults = await Promise.all(sections.map((section) => {
            return this.listArch(`${this.url}/search?size=${config.spider.snaps.page_size}&confinement=strict,devmode,classic&section=${section.name}`, null, section.name);
        }));
        let results = [];
        sectionResults.forEach((sectionResult) => {
            results = results.concat(sectionResult);
        });
        return results;
    }
}

module.exports = SnapApi;