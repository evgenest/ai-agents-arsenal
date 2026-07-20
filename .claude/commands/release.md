---
description: "Release Flow этого проекта одной командой: бамп версии, обновление README/AGENTS/CHANGELOG, commit, push и pre-release"
allowed-tools: ["Bash(git status:*)", "Bash(git branch:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git tag:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)", "Bash(gh release create:*)", "Bash(gh release list:*)", "Bash(bun test:*)", "Bash(bun run typecheck:*)", "Read", "Edit"]
---

# /release

Полный Release Flow проекта (см. `AGENTS.md` → Release Flow) одной командой вместо ручных шагов по отдельности.

`$ARGUMENTS` — опционально: `major` / `minor` / `patch`, либо явная версия (`5.2.0`). Без аргумента — определи бамп сам по накопленным изменениям (шаг 2).

## Шаги

1. **Проверить состояние.** `git status`, `git branch --show-current`. Если ветка не `main`, или есть незакоммиченные изменения, не относящиеся к релизу — сообщи и уточни, прежде чем продолжать. Возьми текущую версию из `package.json`, последний тег (`git tag --sort=-v:refname | head -1`) и список коммитов с прошлого релиза (`git log --oneline <last-tag>..HEAD`).

2. **Определить новую версию.** Явная версия в `$ARGUMENTS` — использовать как есть. `major`/`minor`/`patch` — применить semver-бамп к текущей. Без аргумента — оценить по объёму и характеру изменений (как в истории проекта: v5.0.0 — major при архитектурных изменениях в установке скиллов, v5.0.1 — patch за точечный фикс хука, v5.1.0 — minor за новый флаг и синхронизацию конфига) и одной строкой предложить версию с обоснованием перед тем, как применять.

3. **Обновить `CHANGELOG.md`.** Новая запись сразу после intro-абзацев, перед предыдущей версией, в существующем формате файла:
   ```
   ## v<VERSION> - <короткий заголовок>

   Release date: <YYYY-MM-DD>

   Tag: `v<VERSION>`

   Changes since `<last-tag>`:
   - <по пункту на каждое существенное изменение — с файлами/модулями>

   Net effect:
   - <1-2 пункта — что это значит для пользователей/проекта>
   ```
   Дату брать из текущей системной даты. Текст — по-английски, как остальной файл.

4. **Обновить `package.json`.** Поле `version` → новая версия.

5. **Обновить `README.md` и `AGENTS.md`.** Пройтись по изменениям с прошлого релиза и поправить то, что реально разошлось с кодом (флаги, таблицы скиллов/агентов, описания шагов и т.п.). Не переписывать то, что не изменилось.

6. **Прогнать проверки.** `bun run typecheck` и `bun test` — должны быть зелёными до коммита. Если падают — остановиться, ничего не коммитить, сообщить, что сломалось.

7. **Закоммитить.** Застейджить `package.json`, `CHANGELOG.md` и все тронутые доки одним коммитом. Сообщение — на русском, в стиле существующих release-коммитов (см. `git log --grep="chore(release)"` для образца): заголовок `chore(release): <кратко по-русски>`, абзац контекста, список конкретных изменений по файлам, при необходимости блок «Бизнес-логика:». Без `--no-verify` — `.githooks/pre-commit` должен пройти сам, раз CHANGELOG уже застейджен.

8. **Запушить в `main`.** `git push`.

9. **Создать pre-release.** Перед этим запомнить ID последнего run'а `publish-npm.yml` на событие `release` — чтобы потом отличить новый run от старых:
   ```bash
   prev_run_id=$(gh run list --workflow=publish-npm.yml --json databaseId,event \
     --jq '[.[] | select(.event=="release")] | first | .databaseId // empty')
   ```
   Затем создать pre-release:
   ```bash
   gh release create v<VERSION> --prerelease --title "v<VERSION> (beta)" --notes "..."
   ```
   `--notes` — сжатая выжимка из CHANGELOG-записи этой версии, не копия один-в-один.

10. **Дождаться CI.** GitHub запускает workflow не мгновенно — сначала подождать, пока появится новый run, затем дождаться его завершения:
    ```bash
    run_id=""
    for i in $(seq 1 30); do
      candidate=$(gh run list --workflow=publish-npm.yml --json databaseId,event \
        --jq '[.[] | select(.event=="release")] | first | .databaseId // empty')
      if [ -n "$candidate" ] && [ "$candidate" != "$prev_run_id" ]; then
        run_id="$candidate"
        break
      fi
      sleep 5
    done

    if [ -z "$run_id" ]; then
      echo "run не появился за ~2.5 минуты — проверить вручную: gh run list --workflow=publish-npm.yml"
    else
      gh run watch "$run_id" --exit-status
    fi
    ```
    `gh run watch --exit-status` сам поллит статус и блокируется до завершения run'а (обычно несколько минут: install, tests, typecheck, npm publish) — вызывать через Bash с достаточным таймаутом (до 600000 мс) или в фоне (`run_in_background`), не опрашивать вручную короткими `sleep`. Если run не появился за отведённое время — не считать это ни успехом, ни провалом, а сообщить пользователю как отдельную проблему (см. шаг 11).

11. **Проверить результат и доложить.** После завершения run'а — `gh run view "$run_id" --json conclusion,jobs`:
    - **`conclusion == "success"`**: `verify` и `promote-and-publish` прошли, релиз опубликован в npm и снят с пометки beta. Подтвердить это фактом — `gh release view v<VERSION> --json isPrerelease -q .isPrerelease` должно вернуть `false`. Сообщить пользователю: версия, ссылка на релиз (теперь stable), что ничего вручную делать не нужно.
    - **`conclusion != "success"` (или run не появился)**: релиз остаётся pre-release, в npm ничего не опубликовано. Найти упавший job/step (`gh run view "$run_id" --json jobs --jq '.jobs[] | select(.conclusion!="success")'`), показать хвост лога (`gh run view "$run_id" --log-failed | tail -50`), явно сказать пользователю, что автоматическая часть релиза не завершилась, и что делать дальше (поправить причину и запушить фикс — CI перезапустится на этот же pre-release release, либо вручную `gh run rerun "$run_id" --failed`). Не выдавать это за успешный релиз.

## Что не делать

- Не запускать `npm publish` вручную — это делает CI.
- Не промоутить релиз из pre-release в stable вручную — CI делает это после `verify`.
- Не использовать `git commit --no-verify` или `git push --force`.
- Если `bun test` / `typecheck` падают — не коммитить, остановиться и сообщить.
- Не докладывать релиз как успешный, пока `gh run watch` не подтвердил `conclusion == "success"` — сам факт `gh release create` ничего не гарантирует, CI ещё может упасть.
