-- Annulation de 0039_git.sql (spec 021) : tables de Git et GitHub retirées, dans l'ordre inverse des dépendances.
DROP TABLE `git_conflict_hunks`;
DROP TABLE `git_merge_sessions`;
DROP TABLE `git_issue_links`;
DROP TABLE `git_author_aliases`;
DROP TABLE `git_operations`;
DROP TABLE `git_clones_running`;
DROP TABLE `git_repos`;
