import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { Request, Response } from 'express';
import { sonolus } from './index.js';

const SCP_DIR = './levels/scp';
const SCP_EXTRACT_DIR = './lib/scp';

const loc = (str: string) => ({ en: str });
const tags = (t?: { title: string }[]) => (t ?? []).map(tag => ({ title: loc(tag.title) }));

type Srl = { hash: string; url: string };

type ScpEngine = {
    name: string;
    version: number;
    title: string;
    subtitle?: string;
    author?: string;
    tags?: { title: string }[];
    skin: { name: string; version: number; title: string; subtitle?: string; author?: string; tags?: { title: string }[]; thumbnail: Srl; data: Srl; texture: Srl };
    background: { name: string; version: number; title: string; subtitle?: string; author?: string; tags?: { title: string }[]; thumbnail: Srl; data: Srl; image: Srl; configuration: Srl };
    effect: { name: string; version: number; title: string; subtitle?: string; author?: string; tags?: { title: string }[]; thumbnail: Srl; data: Srl; audio: Srl };
    particle: { name: string; version: number; title: string; subtitle?: string; author?: string; tags?: { title: string }[]; thumbnail: Srl; data: Srl; texture: Srl };
    thumbnail: Srl;
    playData: Srl;
    watchData: Srl;
    previewData: Srl;
    tutorialData: Srl;
    configuration: Srl;
};

type ScpLevelJson = {
    item: {
        name: string;
        version: number;
        title: string;
        artists?: string;
        author?: string;
        rating?: number;
        tags?: { title: string }[];
        engine: ScpEngine;
        cover: Srl;
        data: Srl;
        bgm: Srl;
    };
};

export const setupScpRepository = () => {
    sonolus.router.get('/sonolus/repository/:hash', async (req: Request, res: Response) => {
        const { hash } = req.params as { hash: string };

        if (!fs.existsSync(SCP_EXTRACT_DIR)) {
            res.status(404).send('Not found');
            return;
        }

        try {
            const packages = await fs.promises.readdir(SCP_EXTRACT_DIR);
            for (const pkg of packages) {
                const filePath = path.join(SCP_EXTRACT_DIR, pkg, 'sonolus', 'repository', hash);
                try {
                    const fileBuffer = await fs.promises.readFile(filePath);
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.send(fileBuffer);
                    return;
                } catch {
                    // このパッケージには存在しない、次を探す
                }
            }
            res.status(404).send('Not found');
        } catch {
            res.status(500).send('Internal server error');
        }
    });
};

export const loadScpFiles = async () => {
    if (!fs.existsSync(SCP_DIR)) {
        fs.mkdirSync(SCP_DIR, { recursive: true });
        console.log(`Created ${SCP_DIR}`);
        return;
    }

    const scpFiles = (await fs.promises.readdir(SCP_DIR)).filter(f => f.endsWith('.scp'));

    if (scpFiles.length === 0) {
        console.log('No SCP files found in levels/scp/');
        return;
    }

    console.log(`Found ${scpFiles.length} SCP file(s)`);

    for (const scpFile of scpFiles) {
        const scpPath = path.join(SCP_DIR, scpFile);
        const packageName = path.basename(scpFile, '.scp');
        const extractPath = path.join(SCP_EXTRACT_DIR, packageName);

        try {
            if (!fs.existsSync(extractPath)) {
                console.log(`Extracting ${scpFile}...`);
                const zip = new AdmZip(scpPath);
                zip.extractAllTo(extractPath, true);
                console.log(`Extracted: ${packageName}`);
            }

            const levelsDir = path.join(extractPath, 'sonolus', 'levels');
            if (!fs.existsSync(levelsDir)) {
                console.log(`[!] levels/ not found in ${scpFile}`);
                continue;
            }

            const levelFiles = (await fs.promises.readdir(levelsDir))
                .filter(f => f !== 'list' && f !== 'info');

            const registeredSkins = new Set(sonolus.skin.items.map(i => i.name));
            const registeredBackgrounds = new Set(sonolus.background.items.map(i => i.name));
            const registeredEffects = new Set(sonolus.effect.items.map(i => i.name));
            const registeredParticles = new Set(sonolus.particle.items.map(i => i.name));
            const registeredEngines = new Set(sonolus.engine.items.map(i => i.name));
            const registeredLevels = new Set(sonolus.level.items.map(i => i.name));

            let count = 0;
            for (const levelFile of levelFiles) {
                const levelPath = path.join(levelsDir, levelFile);
                try {
                    const levelJson = JSON.parse(fs.readFileSync(levelPath, 'utf-8')) as ScpLevelJson;
                    const { item } = levelJson;
                    const eng = item.engine;

                    if (!registeredSkins.has(eng.skin.name)) {
                        sonolus.skin.items.push({
                            name: eng.skin.name,
                            version: 4 as const,
                            title: loc(eng.skin.title),
                            subtitle: loc(eng.skin.subtitle ?? ''),
                            author: loc(eng.skin.author ?? ''),
                            tags: tags(eng.skin.tags),
                            thumbnail: eng.skin.thumbnail,
                            data: eng.skin.data,
                            texture: eng.skin.texture,
                        });
                        registeredSkins.add(eng.skin.name);
                    }

                    if (!registeredBackgrounds.has(eng.background.name)) {
                        sonolus.background.items.push({
                            name: eng.background.name,
                            version: 2 as const,
                            title: loc(eng.background.title),
                            subtitle: loc(eng.background.subtitle ?? ''),
                            author: loc(eng.background.author ?? ''),
                            tags: tags(eng.background.tags),
                            thumbnail: eng.background.thumbnail,
                            data: eng.background.data,
                            image: eng.background.image,
                            configuration: eng.background.configuration,
                        });
                        registeredBackgrounds.add(eng.background.name);
                    }

                    if (!registeredEffects.has(eng.effect.name)) {
                        sonolus.effect.items.push({
                            name: eng.effect.name,
                            version: 5 as const,
                            title: loc(eng.effect.title),
                            subtitle: loc(eng.effect.subtitle ?? ''),
                            author: loc(eng.effect.author ?? ''),
                            tags: tags(eng.effect.tags),
                            thumbnail: eng.effect.thumbnail,
                            data: eng.effect.data,
                            audio: eng.effect.audio,
                        });
                        registeredEffects.add(eng.effect.name);
                    }

                    if (!registeredParticles.has(eng.particle.name)) {
                        sonolus.particle.items.push({
                            name: eng.particle.name,
                            version: 3 as const,
                            title: loc(eng.particle.title),
                            subtitle: loc(eng.particle.subtitle ?? ''),
                            author: loc(eng.particle.author ?? ''),
                            tags: tags(eng.particle.tags),
                            thumbnail: eng.particle.thumbnail,
                            data: eng.particle.data,
                            texture: eng.particle.texture,
                        });
                        registeredParticles.add(eng.particle.name);
                    }

                    if (!registeredEngines.has(eng.name)) {
                        sonolus.engine.items.push({
                            name: eng.name,
                            version: 13 as const,
                            title: loc(eng.title),
                            subtitle: loc(eng.subtitle ?? ''),
                            author: loc(eng.author ?? ''),
                            tags: tags(eng.tags),
                            skin: eng.skin.name,
                            background: eng.background.name,
                            effect: eng.effect.name,
                            particle: eng.particle.name,
                            thumbnail: eng.thumbnail,
                            playData: eng.playData,
                            watchData: eng.watchData,
                            previewData: eng.previewData,
                            tutorialData: eng.tutorialData,
                            configuration: eng.configuration,
                        });
                        registeredEngines.add(eng.name);
                    }

                    if (!registeredLevels.has(item.name)) {
                        sonolus.level.items.push({
                            name: item.name,
                            version: 1 as const,
                            title: loc(item.title),
                            artists: loc(item.artists ?? ''),
                            author: loc(item.author ?? ''),
                            rating: item.rating ?? 0,
                            tags: tags(item.tags),
                            engine: eng.name,
                            useSkin: { useDefault: true },
                            useBackground: { useDefault: true },
                            useEffect: { useDefault: true },
                            useParticle: { useDefault: true },
                            cover: item.cover,
                            data: item.data,
                            bgm: item.bgm,
                        });
                        registeredLevels.add(item.name);
                        count++;
                    }
                } catch (e) {
                    console.error(`Error loading level ${levelFile}:`, e);
                }
            }

            console.log(`Loaded ${count} level(s) from ${scpFile}`);
        } catch (e) {
            console.error(`Error loading ${scpFile}:`, e);
        }
    }
};
