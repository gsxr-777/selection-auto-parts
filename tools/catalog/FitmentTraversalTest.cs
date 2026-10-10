// Offline regression for category traversal; fixtures are never imported into the catalog.
using System;
using System.Collections.Generic;
class FixtureId {public string ID {get;set;} public FixtureId(string id){ID=id;}}
class FixturePair {
 public FixtureId Product {get;set;}
 public FixtureId Supplier {get;set;}
 public FixturePair(string product,string supplier){Product=new FixtureId(product);Supplier=new FixtureId(supplier);}
}
class FixtureNode {
 public string ID {get;set;} public string Description {get{return ID;}}
 public List<FixtureNode> Nodes {get;set;} public List<FixturePair> Pairs {get;set;}
 public FixtureNode(string id,params FixtureNode[] children){ID=id;Nodes=new List<FixtureNode>(children);Pairs=new List<FixturePair>();}
}
class FixtureTree {
 public string ID {get{return "1";}}
 public Dictionary<FixtureNode,int> Calls=new Dictionary<FixtureNode,int>();
 public List<FixturePair> GetProductDatasuppliers(FixtureNode node){Calls[node]=Calls.ContainsKey(node)?Calls[node]+1:1;return node.Pairs;}
}
partial class CatalogExport {
 public static void CheckFitmentTraversal(){
  FixtureNode leaf=new FixtureNode("leaf"),other=new FixtureNode("other"),parent=new FixtureNode("parent",leaf,other),onlyParent=new FixtureNode("only-parent",new FixtureNode("empty"));
  foreach(var node in new FixtureNode[]{leaf,parent,onlyParent})node.Pairs.Add(new FixturePair("193","1"));
  other.Pairs.Add(new FixturePair("193","2"));other.Pairs.Add(new FixturePair("999","1"));
  var tree=new FixtureTree();var categories=new List<object>();var direct=new List<string>();
  FitmentNodes(tree,tree,new FixtureNode[]{parent,onlyParent},null,"193","1",new Dictionary<object,bool>(),new List<object>(),categories,direct);
  if(String.Join(",",direct)!="1:leaf,1:only-parent")throw new Exception("Aggregate parents or unrelated suppliers became direct assignments");
  if(categories.Count!=3||(string)((Dictionary<string,object>)categories[1])["parentId"]!="1:parent")throw new Exception("Category ancestry was lost");
  foreach(var calls in tree.Calls.Values)if(calls!=1)throw new Exception("Repeated node lookup was not cached");
  Console.WriteLine("Fitment traversal passed: exact product/supplier, ancestry, parent-only products and single reads");
 }
}
class FitmentTraversalTest {static void Main(){CatalogExport.CheckFitmentTraversal();}}
