-- Annulation de 0009_neuron_absorbed.sql (le rattrapage des questions closes n'est pas rejoué).
ALTER TABLE `neurons` DROP COLUMN `absorbed_in`;
