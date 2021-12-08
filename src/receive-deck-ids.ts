import { AllCardsService, ReferenceCard } from '@firestone-hs/reference-data';
import { SecretsManager } from 'aws-sdk';
import { GetSecretValueRequest } from 'aws-sdk/clients/secretsmanager';
import { gzipSync } from 'zlib';
import { S3 } from './db/s3';
import { getSecret } from './db/secrets';
import { DeckConfig } from './deck-config';

const allCards = new AllCardsService();
const s3 = new S3();
const secretsManager = new SecretsManager({ region: 'us-west-2' });

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	try {
		const secretRequest: GetSecretValueRequest = {
			SecretId: 'third-party-keys',
		};
		const secret: any = await getSecret(secretsManager, secretRequest);
		const inputToken = event.headers['x-firestone-third-party-token'];
		if (inputToken !== secret.vsKey) {
			console.warn('unauthorized', inputToken, secret.vsKey);
			return {
				statusCode: 401,
				isBase64Encoded: false,
				body: JSON.stringify({
					message: 'invalid or missing x-firestone-third-party-token header ' + inputToken,
				}),
			};
		}

		await allCards.initializeCardsDb();
		const collectibleCards: readonly ReferenceCard[] = allCards.getCards().filter(card => card.collectible);

		const csvInput: string = event.body;

		const lines: string[] = csvInput.split(/\r?\n/);
		const input: any[] = lines.slice(1).map(line => toInput(line));
		const decksConfig: readonly DeckConfig[] = generateDecksConfig(input, collectibleCards);

		const stringResults = JSON.stringify(decksConfig);
		const gzippedResults = gzipSync(stringResults);
		await s3.writeFile(
			gzippedResults,
			'static.zerotoheroes.com',
			'api/decks-config.json',
			'application/json',
			'gzip',
		);

		const response = {
			statusCode: 200,
			isBase64Encoded: false,
			body: JSON.stringify('thanks!'),
		};
		return response;
	} catch (e) {
		console.error('issue building config', e);
		const response = {
			statusCode: 500,
			isBase64Encoded: false,
			body: JSON.stringify({ message: 'not ok', exception: e }),
		};
		return response;
	}
};

const toInput = (line: string): any => {
	const splits = line.split('\t');
	return {
		class: splits[1].toLowerCase(),
		archetype: splits[2],
		cardName: `${splits[3]}`,
		points: splits[4],
		gameFormat: splits[5],
	};
};

const generateDecksConfig = (input: any[], collectibleCards: readonly ReferenceCard[]): readonly DeckConfig[] => {
	return input.map(item => {
		return {
			class: item.class.toLowerCase(),
			archetype: item.archetype.replace(/\s/g, '_').toLowerCase(),
			cardId: getCardFromName(collectibleCards, item.cardName),
			points: item.points,
			gameFormat: item.gameFormat.toLowerCase(),
		};
	});
};

const getCardFromName = (collectibleCards: readonly ReferenceCard[], cardName: string): string => {
	let matches = collectibleCards.filter(card => card.name === cardName);
	if (matches.length !== 1) {
		matches = matches.filter(card => card.type !== 'Hero');
		if (matches.length !== 1) {
			console.error('invalid matches', cardName, matches);
		}
	}
	return matches[0].id;
};
