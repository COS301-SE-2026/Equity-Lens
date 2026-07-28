import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewsInvestment from "./News"
import api from "../../services/api"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/api", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

describe("This testing is for the News Page", () => 
{

    api.get.mockImplementation((gettingThePage) =>{
        if(gettingThePage === "/watchlist/")
        {
            return Promise.resolve({
                data: {
                    watchlist:[{id: 1, ticker: "AAPL",company_name: "Apple INC",current_price: 215.50, change_percent: 2.15,}],
                    highest:{ticker:"AAPL", sector:"Technology",current_price: 215.30, change_percent: 2.15},
                    lowest:{ticker: "TSLA", sector:"Politics",current_price: 310.50, change_percent: -1.35}
                }
            })
        }

        if(gettingThePage.startsWith("/news/"))
        {
            return Promise.resolve({
                data: {
                    results:[{article_id: 1, title:"The stocks of today", description: "today was high", source_name: "source 1", image_url:"url_test", pubDate: "2026-07-15", category: ["Business"]}],
                }
            })
        }

        return Promise.resolve({ data: {},})
    })


  it("To Show the title of the page", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Investment News")
    ).toBeInTheDocument();

  });


    it("To Show the page description", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Stay updated with the latest market news and insights")
    ).toBeInTheDocument();

  });


   it("To Show the Top Gainer section", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Top Gainer")
    ).toBeInTheDocument();

  });


  
   it("To Show the Top Loser section", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Top Loser")
    ).toBeInTheDocument();

  });

    it("To Show the Latest News Section", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Latest News")
    ).toBeInTheDocument();

  });


  it("To Show the Latest News category buttons", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("All")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Top")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Business")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Technology")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Politics")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Crime")
    ).toBeInTheDocument();

  });


  it("To Show the watchlist table headings", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Ticker")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Price")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Change")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Action")
    ).toBeInTheDocument();

  });


  it("To Show when the watchlist is empty", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("No watchlist stocks added")
    ).toBeInTheDocument();


  });


  it("To Show the ticker and also the Add Button in the table", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByPlaceholderText("Ticker")
    ).toBeInTheDocument();


  });


    it("To Show the AI suggestion Box", () => {
    render(<NewsInvestment />);

    expect(
      screen.getByText("Why is my top gainer up ?")
    ).toBeInTheDocument();

     expect(
      screen.getByText("Why is my top loser down ?")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Which watchlist stock is the best ?")
    ).toBeInTheDocument();

     expect(
      screen.getByText("Summarise today's news")
    ).toBeInTheDocument();


  });

  it("To Show the data of the top gainer and top loser", async () => {
    render(<NewsInvestment />);

    expect(
      await screen.findByText("AAPL(Technology)")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("+2.15")
    ).toBeInTheDocument();


     expect(
      await screen.findByText("TSLA(Politics)")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("-1.35")
    ).toBeInTheDocument();

   });


    it("To Show how many watchlist he has", async () => {

    render(<NewsInvestment />);

    expect(
      await screen.findByText("My Watchlists")
    ).toBeInTheDocument();
     expect(
      await screen.findByText("1")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Stocks")
    ).toBeInTheDocument();

     });

      it("To Show both the watchlist and news data of the user", async () => {

    render(<NewsInvestment />);

     expect(
      await screen.findByText("AAPL")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Apple INC")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("215.5")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("2.15")
    ).toBeInTheDocument();


     expect(
      await screen.findByText("The stocks of today")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("today was high")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("source 1")
    ).toBeInTheDocument();

     expect(
      await screen.findByText("2026-07-15")
    ).toBeInTheDocument();


  });


   it("Calls the correct API when a news category is pressed", async () => {

    const userTyping = userEvent.setup();

    render(<NewsInvestment />);

    await userTyping.click(screen.getByText("All"))
    expect(api.get).toHaveBeenCalledWith("/news/?category=business")

    await userTyping.click(screen.getByText("Top"))
    expect(api.get).toHaveBeenCalledWith("/news/?category=Top")

    await userTyping.click(screen.getByText("Technology"))
    expect(api.get).toHaveBeenCalledWith("/news/?category=Technology")

    await userTyping.click(screen.getByText("Politics"))
    expect(api.get).toHaveBeenCalledWith("/news/?category=Politics")

    await userTyping.click(screen.getByText("Crime"))
    expect(api.get).toHaveBeenCalledWith("/news/?category=Crime")


     });


     it("To add a stock in the database", async () => {

    const userTyping = userEvent.setup();

    render(<NewsInvestment />);

    await userTyping.type(screen.getByPlaceholderText("Ticker"), "AAPL")
    await userTyping.click(screen.getByText("Add"))
    expect(api.post).toHaveBeenCalledWith("/watchlist/",{ticker: "AAPL"})

 

     });


});