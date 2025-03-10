import fs from 'fs';
import path from 'path';

const guidelinesPath = path.join(__dirname, '../../guidelines/default.txt');

export const getGuidelines = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
        fs.readFile(guidelinesPath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

export const saveGuidelines = async (guidelines: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.writeFile(guidelinesPath, guidelines, 'utf8', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};