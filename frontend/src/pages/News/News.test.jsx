import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewsInvestment from "./News"
import api from "../../services/api"

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
                    watchlist:[],
                    highest:[],
                    lowest:[]
                }
            })
        }

        if(gettingThePage.startsWith("/news/"))
        {
            return Promise.resolve({
                data: {
                    results:[],
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

  


});