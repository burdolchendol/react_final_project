# Stock Analyzer: how to use it

A website that checks US companies against Benjamin Graham's rules. It uses free data from the SEC (company reports) and Defeat Beta (share prices).

Just follow the steps in order. 🙂

---

## 🧰 Before the first time (do this once)

You need:

1. **Ubuntu (WSL)** on your Windows computer. It's the black window where you type commands.
2. **Node version 22.** Open Ubuntu and type:
   ```
   nvm install 22
   ```
3. **Your name and email in a file called `.env`**, because the SEC wants to know who is asking.
   - In the project folder, copy the file `.env.example` and name the copy `.env`.
   - Open `.env` and change the line to your own name and email:
     ```
     SEC_USER_AGENT="Your Name your@email.com"
     SEC_ZIP_DIR="/mnt/c/Users/User/Documents/stockexchangeapp/sec-zips"
     ```
4. **The tools the project needs.** In Ubuntu, type:
   ```
   cd /mnt/c/Users/User/Documents/stockexchangeapp/react_final_project
   npm install
   ```

---

## 🔄 Getting new data

Do this **about once a week**. Use the same steps the first time too.

### Step 1: Download 4 files into the `sec-zips` folder

The folder is `C:\Users\User\Documents\stockexchangeapp\sec-zips`.

| File | Where to get it | Size |
|---|---|---|
| `companyfacts.zip` | https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip | over 1 GB |
| `submissions.zip` | https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip | over 1 GB |
| `stock_prices.parquet` | https://huggingface.co/datasets/defeatbeta/yahoo-finance-data/tree/main/data/US | about 470 MB |
| `exchange_rate.parquet` | the same Hugging Face page | small |

Replace the old files with the new ones.

> You can skip this step. The program will download the files by itself, but that's slower and it deletes them afterwards.

### Step 2: Let the program read them

In Ubuntu, type:
```
cd /mnt/c/Users/User/Documents/stockexchangeapp/react_final_project
nvm use 22
npm run fetch:us
```
Wait until you see **`Snapshot ready in public/data/us/`**. This usually takes a few minutes.

If something goes wrong, your old data is kept safe. Nothing is lost.

### ⏰ Best time to update

- **Any time after 9 am Singapore time.** The US stock market closes at 4 pm New York time, which is 5 am in Singapore (4 am in the US summer), and the data websites need a little time to catch up after that.
- **Saturday morning is easiest.** The week's prices are finished, and nothing changes over the weekend.
- Company reports only change a few times a year, so once a week is plenty.
- The Screener shows **"data refreshed …"** at the top, which tells you how old your data is.

---

## ▶️ Opening the website

In Ubuntu (in the project folder), type:
```
npm run dev
```
Then open the link it shows, usually **http://localhost:5173/react_final_project/**, in your browser.

To stop it, click the Ubuntu window and press **Ctrl + C**.

---

## ⬇️ Getting the newest version of the app

When Claude tells you something new was added:
```
git pull
npm install
```
If Claude says the data changed too, run `npm run fetch:us` again.

---

## ✨ All the commands

Type these in Ubuntu, inside the project folder.

| Command | What it does |
|---|---|
| `npm run dev` | Opens the website on your computer |
| `npm run fetch:us` | Gets new data for **all** US companies (about 6,000) |
| `npm run fetch:us:quick` | Gets data for just **18 well-known companies**. It's fast and good for trying things out. |
| `npm test` | Checks the program still works. You should see `fail 0`. |
| `npm run build` | Makes the finished website files, in the `dist` folder |
| `npm run preview` | Opens the finished website, after `build` |
| `npm run deploy` | Puts the website on GitHub Pages so others can see it |
| `npm run lint` | Looks for mistakes in the code |

### Extra options for `fetch:us`

Put `--` and then the option after the command, like this:
```
npm run fetch:us -- --no-prices
```

| Option | What it does |
|---|---|
| `--tickers AAPL,KO,MSFT` | Only gets these companies |
| `--zip-dir /some/folder` | Reads the downloaded files from this folder instead of the one in `.env` |
| `--no-prices` | Skips share prices, so only company reports are read. Faster. |
| `--no-yahoo` | Only uses the Defeat Beta price file, never Yahoo |
| `--no-sectors` | Skips `submissions.zip` (industry names). Faster. |
| `--keep-zips` | Keeps the files the program downloaded itself, so you can run it again today without downloading again |

---

## 🆘 If something goes wrong

| You see | Do this |
|---|---|
| `HTTP 403` from SEC | Check that `.env` has your real name and email |
| `EACCES` or permission errors | Close the website (Ctrl + C) and try again. If it still fails, delete the `node_modules` folder and run `npm install` |
| `command not found: npm` | Type `nvm use 22` first |
| The website shows no companies | Run `npm run fetch:us` first |
| A price looks different from Google | The ▲/▼ % on the ticker tape compares with **last week's** close, not yesterday's |

---

## 📚 Want to know how a number is calculated?

See **[formulas.md](formulas.md)**. It explains every column and where each number comes from.
