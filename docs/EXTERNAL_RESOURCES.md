# External resources and provenance

This record is for honest disclosure during judging. It does not establish competition eligibility or ownership of any third-party mark.

| Resource | Actual use | Provenance / limitation |
| --- | --- | --- |
| React, React DOM, TypeScript, Vite | Frontend and build | Open-source packages declared in `package.json` and pinned through `package-lock.json`. |
| Recharts and Lucide React | Charts and icons | Open-source packages declared in `package.json`; check package notices before redistribution. |
| FastAPI, Uvicorn, Pydantic, python-multipart | HTTP API and CSV upload | Python packages declared in `requirements.txt`. |
| scikit-learn Random Forest | Three forecast regressors and validation | No external pretrained model or hosted model is used. |
| SQLite | Local persistent demo state | Python standard-library database; file location is configurable. |
| Synthetic Dhaka-area history | Seeded model training, validation, and demo replay | Generated in `backend/core.py` with fixed random seeds. No real customer records or external dataset was supplied. |
| upay brand direction | Blue `#2253A0`, yellow `#F8D749`, and product name | Supplied in the earlier project brief. No clean logo file was present in the workspace; the UI uses a text wordmark. No official integration or endorsement is claimed. |
| Codex AI coding assistant | Creation and refinement of this project in the available workspace conversation | This project existed before this submission-preparation request and was built with Codex assistance. The current Git snapshot starts after that work. Exact original development-period eligibility and any earlier work outside this workspace are unverified. The team should retain relevant prompt/development history if judges ask. |
| External APIs or paid services | None in the running prototype | No map, LLM, upay, or cloud API key is required. |

The installed dependency licenses have not been audited in this document. `package.json` currently declares `ISC` for this local project, but a separate project license file and team ownership decision have not been provided. The hackathon rulebook permits frameworks and open-source libraries while requiring disclosure of significant external or pre-existing work when requested; see the [official rules](https://aidevfest.top/rules).
