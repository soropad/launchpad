import * as StellarSdk from "@stellar/stellar-sdk";

async function main() {
    const horizon = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
    try {
        const response = await horizon.operations()
            .forAccount("CBXKZNUDODE3BIWJZJI4H4CQD3K77NYRIQGRGV37GQCPMAC5M4DLJWD4")
            .limit(1)
            .call();

        console.log("Success with C... address!", response.records.length);
    } catch (e: any) {
        console.error("Error with C... address:", e.response?.data || e.message);
    }
}

main();
