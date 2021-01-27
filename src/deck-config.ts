export interface DeckConfig {
	readonly class: string;
	readonly archetype: string;
	readonly cardId: string;
	readonly points: number;
	readonly gameFormat: 'standard' | 'wild';
}
