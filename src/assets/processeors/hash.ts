import * as fs from 'fs';
import * as crypto from 'crypto';

export function sha256File(path: string): Promise<string>{
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const steam = fs.createReadStream(path);

        steam.on('data', (data) => hash.update(data));
        steam.on('end', () => resolve(hash.digest('hex')));
        steam.on('error', (err) => reject(err));
    });
}